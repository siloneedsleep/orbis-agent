import type { CoreState, Point } from "@/core/TheCore";

export interface CoreModel {
  /** Core có đang hiện trên overlay không (false = ngủ, unmount hết animation). */
  awake: boolean;
  /** Đang bay về dock để đi ngủ; hạ cánh xong sẽ chuyển awake = false. */
  sleeping: boolean;
  state: CoreState;
  /** Vị trí gốc (góc trên-trái, px). Khi đang bay thì là điểm xuất phát. */
  position: Point;
  target?: Point;
}

export type CoreAction =
  /** Hotkey/tray: ngủ → bay từ dock lên `home`; thức → bay về `dock` rồi ngủ. */
  | { type: "toggle"; dock: Point; home: Point }
  | { type: "think" }
  | { type: "idle" }
  | { type: "flyTo"; target: Point }
  | { type: "landed" };

export const initialCoreModel: CoreModel = {
  awake: false,
  sleeping: false,
  state: "idle",
  position: { x: 0, y: 0 },
};

export function coreReducer(model: CoreModel, action: CoreAction): CoreModel {
  switch (action.type) {
    case "toggle": {
      if (!model.awake) {
        return {
          awake: true,
          sleeping: false,
          state: "flying",
          position: action.dock,
          target: action.home,
        };
      }
      // Đang bay thì bỏ qua: đổi target giữa chuyến sẽ làm Core giật về điểm xuất phát.
      if (model.state === "flying") return model;
      return { ...model, sleeping: true, state: "flying", target: action.dock };
    }

    case "think":
      return model.awake && !model.sleeping && model.state === "idle"
        ? { ...model, state: "thinking" }
        : model;

    case "idle":
      return model.state === "thinking" ? { ...model, state: "idle" } : model;

    case "flyTo":
      return model.awake && !model.sleeping && model.state !== "flying"
        ? { ...model, state: "flying", target: action.target }
        : model;

    case "landed": {
      if (model.state !== "flying" || !model.target) return model;
      return {
        awake: !model.sleeping,
        sleeping: false,
        state: "idle",
        position: model.target,
      };
    }
  }
}
