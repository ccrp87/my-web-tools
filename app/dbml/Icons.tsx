const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PanelIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

export function UploadIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 16V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function CopyIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V4a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export function FileDownloadIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3v10" />
      <path d="M8 9l4 4 4-4" />
      <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function DatabaseIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  );
}

export function FramePlusIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export function FolderIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

export function LibraryIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="4" y="3" width="12" height="18" rx="1.5" />
      <path d="M16 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <line x1="8" y1="8" x2="12" y2="8" />
      <line x1="8" y1="12" x2="12" y2="12" />
    </svg>
  );
}

export function CloudUploadIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 18a4.5 4.5 0 0 1-1-8.9 5 5 0 0 1 9.8-1.6A4 4 0 0 1 17 15.9" />
      <path d="M12 12v8" />
      <path d="M9 15l3-3 3 3" />
    </svg>
  );
}

export function CloudDownloadIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 18a4.5 4.5 0 0 1-1-8.9 5 5 0 0 1 9.8-1.6A4 4 0 0 1 17 15.9" />
      <path d="M12 11v8" />
      <path d="M9 16l3 3 3-3" />
    </svg>
  );
}

export function ChevronDownIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS} width={12} height={12}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function CloudIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 18a4.5 4.5 0 0 1-1-8.9 5 5 0 0 1 9.8-1.6A4 4 0 0 1 17 15.9" />
    </svg>
  );
}

export function CloseIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function DatabaseImportIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
      <path d="M12 10v8" />
      <path d="M9 15l3 3 3-3" />
    </svg>
  );
}

export function TrashIcon(): React.JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}
