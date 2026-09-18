{{- define "citegeo.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "citegeo.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "citegeo.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "citegeo.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "citegeo.selectorLabels" -}}
app.kubernetes.io/name: {{ include "citegeo.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "citegeo.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "citegeo.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "citegeo.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- include "citegeo.fullname" . -}}
{{- end -}}
{{- end -}}

{{- define "citegeo.pvcName" -}}
{{- if .Values.persistence.existingClaim -}}
{{- .Values.persistence.existingClaim -}}
{{- else -}}
{{- printf "%s-data" (include "citegeo.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/* Shared env: plain config, then every provider key that is actually set. */}}
{{- define "citegeo.env" -}}
envFrom:
  - configMapRef:
      name: {{ include "citegeo.fullname" . }}
{{- if or .Values.secrets.existingSecret .Values.secrets.create }}
  - secretRef:
      name: {{ include "citegeo.secretName" . }}
{{- end }}
{{- with .Values.extraEnv }}
env:
{{ toYaml . | indent 2 }}
{{- end }}
{{- end -}}
