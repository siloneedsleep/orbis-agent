use ab_glyph::FontArc;
use image::{DynamicImage, Rgba};
use imageproc::{
    drawing::{draw_filled_rect_mut, draw_hollow_rect_mut, draw_text_mut},
    rect::Rect,
};
use serde::Serialize;
use std::{
    collections::VecDeque,
    time::{Duration, Instant},
};
use uiautomation::{
    types::{ControlType, Handle},
    UIAutomation,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Element {
    pub id: u32,
    pub name: String,
    pub control_type: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    #[serde(skip)]
    pub runtime_id: Vec<i32>,
}

#[derive(Clone)]
pub struct Grounding {
    pub hwnd: isize,
    pub elements: Vec<Element>,
    pub captured: Instant,
}

pub fn scan(hwnd: isize) -> Result<Grounding, String> {
    if hwnd == 0 {
        return Err("Hãy chọn ứng dụng đích trước khi giao việc".into());
    }
    let automation = UIAutomation::new().map_err(|e| e.to_string())?;
    let root = automation
        .element_from_handle(Handle::from(hwnd))
        .map_err(|e| e.to_string())?;
    let walker = automation
        .get_control_view_walker()
        .map_err(|e| e.to_string())?;
    let started = Instant::now();
    let mut queue = VecDeque::from([root]);
    let mut elements = Vec::new();
    let mut visited = 0;
    while let Some(node) = queue.pop_front() {
        visited += 1;
        if visited > 1500 || elements.len() >= 120 || started.elapsed() > Duration::from_millis(250)
        {
            break;
        }
        let kind = node.get_control_type().ok();
        let supported = matches!(
            kind,
            Some(
                ControlType::Button
                    | ControlType::Edit
                    | ControlType::MenuItem
                    | ControlType::Hyperlink
                    | ControlType::TabItem
                    | ControlType::CheckBox
                    | ControlType::ComboBox
                    | ControlType::ListItem
                    | ControlType::RadioButton
            )
        );
        if supported
            && node.is_enabled().unwrap_or(false)
            && !node.is_offscreen().unwrap_or(true)
            && !node.is_password().unwrap_or(true)
        {
            if let Ok(rect) = node.get_bounding_rectangle() {
                if rect.get_width() > 0 && rect.get_height() > 0 {
                    elements.push(Element {
                        id: elements.len() as u32 + 1,
                        name: node
                            .get_name()
                            .unwrap_or_default()
                            .chars()
                            .take(160)
                            .collect(),
                        control_type: format!("{:?}", kind.unwrap()),
                        x: rect.get_left(),
                        y: rect.get_top(),
                        width: rect.get_width(),
                        height: rect.get_height(),
                        runtime_id: node.get_runtime_id().unwrap_or_default(),
                    });
                }
            }
        }
        if let Ok(child) = walker.get_first_child(&node) {
            let mut sibling = Some(child);
            while let Some(child) = sibling {
                if queue.len() >= 1500 || started.elapsed() > Duration::from_millis(250) {
                    break;
                }
                sibling = walker.get_next_sibling(&child).ok();
                queue.push_back(child);
            }
        }
    }
    Ok(Grounding {
        hwnd,
        elements,
        captured: Instant::now(),
    })
}

pub fn resolve(snapshot: &Grounding, id: u32) -> Result<(i32, i32), String> {
    if snapshot.captured.elapsed() > Duration::from_secs(180) {
        return Err("Ảnh quan sát đã hết hạn; cần quan sát lại".into());
    }
    let old = snapshot
        .elements
        .iter()
        .find(|e| e.id == id)
        .ok_or("targetId không tồn tại trong quan sát hiện tại")?;
    if old.runtime_id.is_empty() {
        return Err("UIA không cung cấp định danh ổn định cho phần tử này".into());
    }
    let fresh = scan(snapshot.hwnd)?;
    let current = fresh
        .elements
        .iter()
        .find(|e| e.runtime_id == old.runtime_id)
        .ok_or("Phần tử đã biến mất; cần quan sát lại")?;
    Ok((
        current.x + current.width / 2,
        current.y + current.height / 2,
    ))
}

pub fn annotate(image: &mut DynamicImage, elements: &[Element], origin_x: i32, origin_y: i32) {
    let font = std::fs::read(r"C:\Windows\Fonts\segoeui.ttf")
        .ok()
        .and_then(|b| FontArc::try_from_vec(b).ok());
    for e in elements {
        let x = e.x - origin_x;
        let y = e.y - origin_y;
        if x + e.width <= 0
            || y + e.height <= 0
            || x >= image.width() as i32
            || y >= image.height() as i32
        {
            continue;
        }
        draw_hollow_rect_mut(
            image,
            Rect::at(x, y).of_size(e.width as u32, e.height as u32),
            Rgba([255, 205, 40, 255]),
        );
        if let Some(font) = &font {
            let label = format!("[{}]", e.id);
            let bx = x.max(0);
            let by = y.max(0);
            draw_filled_rect_mut(
                image,
                Rect::at(bx, by).of_size((label.len() as u32 * 10).max(25), 22),
                Rgba([10, 16, 25, 255]),
            );
            draw_text_mut(
                image,
                Rgba([255, 220, 70, 255]),
                bx + 2,
                by,
                18.0,
                font,
                &label,
            );
        }
    }
}
