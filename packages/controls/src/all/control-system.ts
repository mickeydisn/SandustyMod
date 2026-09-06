import type { PathStore } from "./store.ts";
import { pathStoreFromRecord } from "./store.ts";
import type { PathRecord } from "./store.ts";
import type {
  ButtonOptions,
  CounterOptions,
  DisplayOptions,
  DpadOptions,
  GaugeOptions,
  LedOptions,
  RangeOptions,
  SelectorOptions,
  TextOptions,
  ToggleOptions,
} from "../register/types.ts";
import {
  registerButton,
  registerCounter,
  registerDisplay,
  registerDpad,
  registerGauge,
  registerLed,
  registerRange,
  registerSelector,
  registerText,
  registerToggle,
} from "../register/items/index.ts";
import { ControlRegistry } from "../register/registry.ts";
import type { ConfigValue, RegisteredControl } from "../types.ts";

/**
 * Binds world structures (buttons, toggles, LEDs, gauges, ...) to a `PathStore`
 * that reads/writes one shared config state. Call `new ControlSystem(store)` then
 * `registerXxx(path, opts)` for each control you want to place.
 */
export class ControlSystem {
  readonly store: PathStore;
  private registry = new ControlRegistry();

  constructor(store: PathStore) {
    this.store = store;
  }

  get(path: string): ConfigValue {
    return this.store.get(path);
  }

  set(path: string, value: ConfigValue): void {
    this.store.set(path, value);
  }

  registerToggle(path: string, opts: ToggleOptions): RegisteredControl {
    return registerToggle(this.store, path, opts);
  }

  registerButton(path: string, opts: ButtonOptions): RegisteredControl {
    return registerButton(this.store, path, opts);
  }

  registerSelector(path: string, opts: SelectorOptions): RegisteredControl {
    return registerSelector(this.store, this.registry, path, opts);
  }

  registerRange(path: string, opts: RangeOptions): RegisteredControl {
    return registerRange(this.store, path, opts);
  }

  registerLed(path: string, opts: LedOptions): RegisteredControl {
    return registerLed(this.store, path, opts);
  }

  registerGauge(path: string, opts: GaugeOptions): RegisteredControl {
    return registerGauge(this.store, path, opts);
  }

  registerDpad(path: string, opts: DpadOptions): RegisteredControl {
    return registerDpad(this.store, path, opts);
  }

  registerText(path: string, opts: TextOptions): RegisteredControl {
    return registerText(this.store, path, opts);
  }

  registerCounter(path: string, opts: CounterOptions): RegisteredControl {
    return registerCounter(this.store, path, opts);
  }

  registerDisplay(path: string, opts: DisplayOptions): RegisteredControl {
    return registerDisplay(this.store, path, opts);
  }
}

/** Convenience: build a control system directly from a `JsonBuffer`-like record. */
export function createControlSystem(record: PathRecord): ControlSystem {
  return new ControlSystem(pathStoreFromRecord(record));
}