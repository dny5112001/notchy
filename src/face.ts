import "./face.css";

export type Mood =
  | "neutral"
  | "happy"
  | "excited"
  | "love"
  | "sad"
  | "sassy"
  | "alarmed"
  | "sleepy"
  | "hot"
  | "wink"
  | "curious"
  | "dying";

export interface Face {
  el: HTMLElement;
  set(mood: Mood, color?: string): void;
}

/** Builds a face that blinks and glances around on its own. */
export function createFace(scale = 1): Face {
  const el = document.createElement("div");
  el.className = "face";
  el.style.setProperty("--s", String(scale));
  el.dataset.mood = "neutral";
  el.innerHTML = `
    <div class="eyes">
      <div class="eye l"><i class="lid top"></i><i class="lid bottom"></i></div>
      <div class="eye r"><i class="lid top"></i><i class="lid bottom"></i></div>
    </div>
    <i class="sweat"></i>`;

  const eyes = el.querySelector<HTMLElement>(".eyes")!;
  const blinkable = () => !["happy", "excited", "love", "wink", "sleepy"].includes(el.dataset.mood!);

  const blink = () => {
    if (el.isConnected && blinkable()) {
      el.classList.add("blink");
      setTimeout(() => el.classList.remove("blink"), 110);
    }
    setTimeout(blink, 2200 + Math.random() * 3200);
  };
  setTimeout(blink, 1200 + Math.random() * 1500);

  // Glance left and right now and then, but only when the mood doesn't move the eyes itself.
  const glance = () => {
    if (el.dataset.mood === "neutral") {
      const x = (Math.random() - 0.5) * 6 * scale;
      eyes.style.transform = `translateX(${x.toFixed(1)}px)`;
    } else {
      eyes.style.transform = "";
    }
    setTimeout(glance, 1800 + Math.random() * 2500);
  };
  setTimeout(glance, 2000);

  return {
    el,
    set(mood, color = "#fff") {
      el.dataset.mood = mood;
      eyes.style.transform = "";
      el.style.setProperty("--eye", color);
    },
  };
}
