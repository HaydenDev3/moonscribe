export type DesignerFontOption = {
  key: string
  label: string
  family?: string
}

declare global {
  interface Window {
    designerFontOptions?: DesignerFontOption[]
  }
}

export {}
