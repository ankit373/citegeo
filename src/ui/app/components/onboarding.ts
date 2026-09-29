import { html } from "../dom.js";
import { button } from "./button.js";

export interface OnboardingStep {
  label: string;
  detail: string;
  complete: boolean;
}

/** A shared progress strip for flows with real prerequisites. */
export function onboardingSteps(steps: OnboardingStep[]): string {
  return '<ol class="setup-steps">' + steps.map((step, index) => '<li class="' + (step.complete ? "is-complete" : "") + '">'
    + '<span class="setup-step-number">' + (step.complete ? "✓" : String(index + 1)) + '</span><div><strong>' + html(step.label) + '</strong><small>' + html(step.detail) + '</small></div></li>').join("") + "</ol>";
}

export interface ConnectionSettingView {
  key: string;
  label: string;
  envKey: string;
  value?: string | null;
  source?: "environment" | "stored" | "none" | undefined;
  editable?: boolean | undefined;
}

export interface ConnectionCardInput {
  providerId: string;
  label: string;
  purpose: string;
  help: string;
  status: "connected" | "incomplete" | "not_connected" | "unavailable";
  credentialControl: string;
  settings: ConnectionSettingView[];
  oauthHelp?: string;
}

function settingEditor(providerId: string, settings: ConnectionSettingView[]): string {
  if (!settings.length) return "";
  const controls = settings.map((setting) => {
    const managed = setting.editable === false;
    return '<label class="connection-setting"><span>' + html(setting.label) + '</span>'
      + '<input type="text" autocomplete="off" data-integration-setting="' + html(providerId + ":" + setting.key) + '" value="' + html(setting.value || "") + '"'
      + (managed ? " readonly" : "") + ' placeholder="' + html(managed ? "Managed by " + setting.envKey : "Not set") + '">'
      + '<small>' + (managed ? "Managed by environment" : "Saved for this workspace") + ' · <span class="mono">' + html(setting.envKey) + "</span></small></label>";
  }).join("");
  const editable = settings.some((setting) => setting.editable !== false);
  return '<div class="connection-settings"><h4>Connection scope</h4><div class="connection-settings-grid">' + controls + '</div>'
    + (editable ? '<div class="inline-actions">' + button({ label: "Save scope", on: { "data-integration-settings-save": providerId } }) + "</div>" : "") + "</div>";
}

/** All outward integrations share this card. It never renders a secret. */
export function connectionCard(input: ConnectionCardInput): string {
  const done = input.status === "connected";
  const state = done
    ? '<span class="mcell state-ok connected-tick" title="Connected" aria-label="Connected">\u2713</span>'
    : input.status === "incomplete"
      ? '<span class="state-flag">Needs a little more</span>'
      : input.status === "not_connected"
        ? '<span class="state-flag">Not connected</span>'
        : '<span class="state-flag">Unavailable on this server</span>';
  return '<article class="section-card connection-card" data-connection="' + html(input.providerId) + '"><div class="section-head"><div><h3>' + html(input.label) + '</h3><p class="subtle">' + html(input.purpose) + '</p></div>' + state + '</div>'
    + (done ? "" : input.oauthHelp || "") + settingEditor(input.providerId, input.settings)
    + (done ? "" : '<p class="field-help">' + html(input.help) + '</p>')
    + '<div class="inline-actions">' + input.credentialControl + "</div></article>";
}
