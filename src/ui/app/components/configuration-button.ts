import { button } from "./button.js";
import type { MonitoringConfigurationState } from "../../../product/configuration/monitoring-configuration-state.js";

/** The saved configuration as the page holds it. Before it loads the page fills in a language of its own. */
export type MonitoringConfigurationView = Omit<MonitoringConfigurationState, "currentLanguage" | "currentProtocol"> & {
  currentLanguage: string;
  currentProtocol: Pick<MonitoringConfigurationState["currentProtocol"], "protocolId" | "protocolVersion" | "promptTemplateHash">;
};

/** Where a save of the monitoring configuration stands, or "idle" before one starts. */
export interface ConfigurationSaveState {
  monitoringSaveState: string;
}

export function configurationVisualState(state: ConfigurationSaveState, configuration: Pick<MonitoringConfigurationState, "status">): string {
  return state.monitoringSaveState === "idle" ? configuration.status : state.monitoringSaveState;
}

// A disabled button reading "✓ saved" is a status wearing the loudest paint
// on the page. It stops leading the moment there is nothing to press.
export function saveConfigurationButton(
  state: ConfigurationSaveState,
  configuration: Pick<MonitoringConfigurationState, "status" | "nextVersion" | "currentVersion">,
  hasModels: boolean,
  lead = true,
): string {
  const visual = configurationVisualState(state, configuration);
  const disabled = !hasModels || visual === "unchanged" || visual === "saving" || visual === "saved";
  const label = visual === "no_version" ? "Save config v1"
    : visual === "unchanged" ? "✓ Current configuration saved"
      : visual === "changed" ? "Save as config v" + configuration.nextVersion
        : visual === "saving" ? "Saving…"
          : visual === "saved" ? "✓ Saved as v" + configuration.currentVersion
            : "Save again";
  return button({
    label,
    kind: lead && !disabled ? "primary" : "secondary",
    disabled,
    id: "save-monitoring-configuration",
    testId: "save-monitoring-configuration",
    on: { "data-action-state": visual },
  });
}
