export type DesignerFontOption = {
  key: string
  label: string
  family?: string
}

declare global {
  interface Window {
    designerFontOptions?: DesignerFontOption[]
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

export {}
