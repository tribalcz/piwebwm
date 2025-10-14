const Icons = {
    //UI icons for windows
    back: '<svg style="transform:rotate(-90deg);transform-origin:center;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                            <circle cx="12" cy="12" r="10" fill="#f0f0f0"/>\n' +
        '                            <path d="M12 16 L12 8 M12 8 L8 12 M12 8 L16 12" stroke="#4a90e2"/>\n' +
        '                        </svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                            <circle cx="12" cy="12" r="10" fill="#f0f0f0"/>\n' +
        '                            <path d="M12 16 L12 8 M12 8 L8 12 M12 8 L16 12" stroke="#4a90e2"/>\n' +
        '                        </svg>',
    home: '<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M12 2L2 9v11a2 2 0 002 2h16a2 2 0 002-2V9L12 2z" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="#dbeafe"/>\n' +
        '                    <rect x="10" y="13" width="4" height="9" fill="#2563eb" rx="0.5"/>\n' +
        '                </svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                        <polyline points="23 4 23 10 17 10" stroke="#10b981"/>\n' +
        '                        <polyline points="1 20 1 14 7 14" stroke="#10b981"/>\n' +
        '                        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="#10b981"/>\n' +
        '                    </svg>',
    //Icons for context menu
    openDir: ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" fill="#fbbf24" stroke="#f59e0b"/>\n' +
        '                        <path d="M6 12l4 3 6-6" stroke="#f59e0b" fill="none"/>\n' +
        '                    </svg>',
    openFile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="#e5e7eb" stroke="#9ca3af"/>\n' +
        '                        <path d="M14 2v6h6" stroke="#9ca3af" fill="none"/>\n' +
        '                        <path d="M10 9l2 2 2-2M12 11v6" stroke="#6b7280" fill="none"/>\n' +
        '                    </svg>',
    rename: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#3b82f6"/>\n' +
        '                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#3b82f6" fill="#dbeafe"/>\n' +
        '                    </svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="#10b981" fill="#d1fae5"/>\n' +
        '                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="#10b981"/>\n' +
        '                    </svg>',
    cut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                        <circle cx="6" cy="6" r="3" stroke="#f59e0b" fill="#fed7aa"/>\n' +
        '                        <circle cx="6" cy="18" r="3" stroke="#f59e0b" fill="#fed7aa"/>\n' +
        '                        <line x1="6" y1="9" x2="6" y2="15" stroke="#f59e0b"/>\n' +
        '                        <polyline points="9 6 21 6" stroke="#f59e0b" stroke-dasharray="3 2"/>\n' +
        '                        <polyline points="9 18 21 18" stroke="#f59e0b" stroke-dasharray="3 2"/>\n' +
        '                    </svg>',//TODO:
    paste: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="#8b5cf6"/>\n' +
        '                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="#8b5cf6" fill="#ddd6fe"/>\n' +
        '                        <path d="M9 14l2 2 4-4" stroke="#8b5cf6"/>\n' +
        '                    </svg>',
    delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                        <polyline points="3 6 5 6 21 6" stroke="#ef4444"/>\n' +
        '                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="#ef4444" fill="#fee2e2"/>\n' +
        '                        <line x1="10" y1="11" x2="10" y2="17" stroke="#ef4444"/>\n' +
        '                        <line x1="14" y1="11" x2="14" y2="17" stroke="#ef4444"/>\n' +
        '                    </svg>',
    newDir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="#e0f2fe" stroke="#0ea5e9"/>\n' +
        '                        <path d="M14 2v6h6" stroke="#0ea5e9" fill="none"/>\n' +
        '                        <line x1="12" y1="11" x2="12" y2="17" stroke="#0ea5e9"/>\n' +
        '                        <line x1="9" y1="14" x2="15" y2="14" stroke="#0ea5e9"/>\n' +
        '                    </svg>',
    newFile: ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n' +
        '                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" fill="#fef3c7" stroke="#fbbf24"/>\n' +
        '                        <line x1="12" y1="11" x2="12" y2="17" stroke="#f59e0b"/>\n' +
        '                        <line x1="9" y1="14" x2="15" y2="14" stroke="#f59e0b"/>\n' +
        '                    </svg>',
    //Icon for file types
    file:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/>\n' +
        '                </svg>',
    txt:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1"/>\n' +
        '                    <path d="M14 2v6h6" fill="none" stroke="#9ca3af" stroke-width="1"/>\n' +
        '                    <path d="M8 13h8M8 17h8" stroke="#6b7280" stroke-width="1"/>\n' +
        '                </svg>',
    md:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="1"/>\n' +
        '                    <path d="M14 2v6h6" fill="none" stroke="#0ea5e9" stroke-width="1"/>\n' +
        '                    <path d="M11 15l-2 2v-2h2zM11 15l4-4a1 1 0 011.4 0l.6.6a1 1 0 010 1.4l-4 4h-2z" fill="#0284c7"/>\n' +
        '                </svg>',
    pdf:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/>\n' +
        '                    <path d="M14 2v6h6" fill="none" stroke="#ef4444" stroke-width="1"/>\n' +
        '                    <text x="12" y="16" text-anchor="middle" fill="#dc2626" font-size="6" font-weight="bold">PDF</text>\n' +
        '                </svg>',
    doc:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="#dbeafe" stroke="#3b82f6" stroke-width="1"/>\n' +
        '                    <path d="M14 2v6h6" fill="none" stroke="#3b82f6" stroke-width="1"/>\n' +
        '                    <text x="12" y="16" text-anchor="middle" fill="#2563eb" font-size="6" font-weight="bold">DOC</text>\n' +
        '                </svg>',
    xls:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="#d1fae5" stroke="#10b981" stroke-width="1"/>\n' +
        '                    <path d="M14 2v6h6" fill="none" stroke="#10b981" stroke-width="1"/>\n' +
        '                    <path d="M8 12h8M8 16h8M12 12v8" stroke="#059669" stroke-width="1"/>\n' +
        '                </svg>',
    jpg:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <rect x="3" y="3" width="18" height="18" rx="2" fill="#fef3c7" stroke="#f59e0b" stroke-width="1"/>\n' +
        '                    <path d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="#f59e0b"/>\n' +
        '                    <path d="M21 15l-5-5L5 21" stroke="#f59e0b" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>\n' +
        '                </svg>',
    music:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M9 18V5l12-2v13" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
        '                    <circle cx="6" cy="18" r="3" fill="#ddd6fe" stroke="#8b5cf6" stroke-width="2"/>\n' +
        '                    <circle cx="18" cy="16" r="3" fill="#ddd6fe" stroke="#8b5cf6" stroke-width="2"/>\n' +
        '                </svg>',
    video:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <rect x="2" y="6" width="20" height="12" rx="2" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/>\n' +
        '                    <path d="M10 9l5 3-5 3V9z" fill="#dc2626"/>\n' +
        '                </svg>',
    archive:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="#e5e7eb" stroke="#6b7280" stroke-width="1"/>\n' +
        '                    <path d="M14 2v6h6" fill="none" stroke="#6b7280" stroke-width="1"/>\n' +
        '                    <path d="M10 12h1v1h-1zM11 13h1v1h-1zM10 14h1v1h-1zM11 15h1v1h-1z" fill="#4b5563"/>\n' +
        '                    <rect x="9" y="17" width="4" height="2" fill="#4b5563" rx="0.5"/>\n' +
        '                </svg>',
    sh:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <rect x="3" y="3" width="18" height="18" rx="2" fill="#1e293b" stroke="#475569" stroke-width="1"/>\n' +
        '                    <path d="M7 8l3 3-3 3M12 16h6" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
        '                </svg>',
    py:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M12 2c-2 0-4 1-4 3v4h4v1H6c-2 0-4 1.5-4 4s2 4 4 4h2v-3c0-1 1-2 2-2h4c1 0 2-1 2-2V5c0-2-2-3-4-3z" fill="#3776ab"/>\n' +
        '                    <path d="M12 22c2 0 4-1 4-3v-4h-4v-1h6c2 0 4-1.5 4-4s-2-4-4-4h-2v3c0 1-1 2-2 2h-4c-1 0-2 1-2 2v6c0 2 2 3 4 3z" fill="#ffd43b"/>\n' +
        '                    <circle cx="9" cy="6" r="1" fill="white"/>\n' +
        '                    <circle cx="15" cy="18" r="1" fill="white"/>\n' +
        '                </svg>',
    js:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <rect x="3" y="3" width="18" height="18" rx="2" fill="#f7df1e"/>\n' +
        '                    <path d="M12 17c0 1.1.9 2 2 2 1.5 0 2.5-.8 2.5-2 0-1.4-1-1.8-2.1-2.2-.7-.2-1.4-.5-1.4-1 0-.4.3-.7.8-.7s.8.3.9.7h1.3c-.1-1.3-1-2-2.2-2-1.2 0-2.1.8-2.1 1.8 0 1.2.9 1.6 1.8 1.9.8.3 1.7.6 1.7 1.3 0 .5-.4.8-1 .8-.7 0-1.1-.4-1.2-1h-1z" fill="#323330"/>\n' +
        '                    <path d="M8 17v-4.5c0-.3-.2-.5-.5-.5S7 12.2 7 12.5h-1c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V17c0 1.1.9 2 2 2v-1c-.6 0-1-.4-1-1z" fill="#323330"/>\n' +
        '                </svg>',
    html:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M3 2l1.5 17L12 22l7.5-3L21 2H3z" fill="#e34c26"/>\n' +
        '                    <path d="M12 8v10l4.5-1.5.5-8.5H12z" fill="#ef652a"/>\n' +
        '                    <path d="M8 9h8l-.2 2H8.2L8 9zM8.5 13h3.5v2l-2 .5-2-.5-.1-1.5" fill="white" opacity="0.9"/>\n' +
        '                    <path d="M12 13h4l-.3 3.5L12 18v-2l2-.5.1-1.5" fill="white"/>\n' +
        '                </svg>',
    css:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M3 2l1.5 17L12 22l7.5-3L21 2H3z" fill="#1572b6"/>\n' +
        '                    <path d="M12 8v10l4.5-1.5.5-8.5H12z" fill="#33a9dc"/>\n' +
        '                    <path d="M8 9h8l-.2 2H8.2L8 9zM8.5 13h7l-.3 3.5L12 18l-3-1.5-.2-2.5h1.5l.1 1 1.6.5 1.6-.5.2-2" fill="white" opacity="0.9"/>\n' +
        '                </svg>',
    unknown:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="url(#gradient1)" stroke="#9ca3af" stroke-width="1"/>\n' +
        '                    <path d="M14 2v6h6" fill="none" stroke="#9ca3af" stroke-width="1"/>\n' +
        '                    <circle cx="8" cy="14" r="1" fill="#6b7280"/>\n' +
        '                    <circle cx="12" cy="14" r="1" fill="#6b7280"/>\n' +
        '                    <circle cx="16" cy="14" r="1" fill="#6b7280"/>\n' +
        '                    <defs>\n' +
        '                        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">\n' +
        '                            <stop offset="0%" style="stop-color:#f9fafb"/>\n' +
        '                            <stop offset="100%" style="stop-color:#e5e7eb"/>\n' +
        '                        </linearGradient>\n' +
        '                    </defs>\n' +
        '                </svg>',
    //Icon for startMenu
    fileManager:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                        <rect x="3" y="7" width="18" height="13" rx="2" fill="#fbbf24"/>\n' +
        '                        <path d="M3 7v-2a2 2 0 012-2h5l2 2h7a2 2 0 012 2v0" stroke="#f59e0b" stroke-width="1.5"/>\n' +
        '                        <rect x="8" y="11" width="8" height="1" fill="#f59e0b" opacity="0.5"/>\n' +
        '                        <rect x="8" y="14" width="5" height="1" fill="#f59e0b" opacity="0.5"/>\n' +
        '                    </svg>',
    terminal:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                        <rect x="3" y="4" width="18" height="16" rx="2" fill="#1e293b"/>\n' +
        '                        <path d="M7 9l3 3-3 3" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>\n' +
        '                        <line x1="13" y1="15" x2="17" y2="15" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>\n' +
        '                    </svg>',
    textEditor:'',
    systemMonitor:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                        <rect x="3" y="3" width="18" height="18" rx="2" fill="#f3f4f6" stroke="#6b7280" stroke-width="1"/>\n' +
        '                        <polyline points="7 13 10 10 13 13 17 8" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
        '                        <circle cx="17" cy="8" r="2" fill="#10b981"/>\n' +
        '                    </svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                        <defs>\n' +
        '                            <linearGradient id="settingsGrad2" x1="0%" y1="0%" x2="0%" y2="100%">\n' +
        '                                <stop offset="0%" style="stop-color:#8b5cf6"/>\n' +
        '                                <stop offset="100%" style="stop-color:#6d28d9"/>\n' +
        '                            </linearGradient>\n' +
        '                        </defs>\n' +
        '                        \n' +
        '                        <g transform="translate(12, 12)">\n' +
        '                            <!-- Zuby -->\n' +
        '                            <rect x="-2" y="-10" width="4" height="3" rx="0.5" fill="url(#settingsGrad2)"/>\n' +
        '                            <rect x="-2" y="7" width="4" height="3" rx="0.5" fill="url(#settingsGrad2)"/>\n' +
        '                            <rect x="-10" y="-2" width="3" height="4" rx="0.5" fill="url(#settingsGrad2)"/>\n' +
        '                            <rect x="7" y="-2" width="3" height="4" rx="0.5" fill="url(#settingsGrad2)"/>\n' +
        '                            \n' +
        '                            <rect x="-2" y="-2" width="4" height="4" rx="0.5" fill="url(#settingsGrad2)" transform="rotate(45)translate(5.5,0)"/>\n' +
        '                            <rect x="-2" y="-2" width="4" height="4" rx="0.5" fill="url(#settingsGrad2)" transform="rotate(45)translate(-5.5,0)"/>\n' +
        '                            <rect x="-2" y="-2" width="4" height="4" rx="0.5" fill="url(#settingsGrad2)" transform="rotate(45)translate(0,5.5)"/>\n' +
        '                            <rect x="-2" y="-2" width="4" height="4" rx="0.5" fill="url(#settingsGrad2)" transform="rotate(45)translate(0,-5.5)"/>\n' +
        '                            \n' +
        '                            <circle cx="0" cy="0" r="5" fill="url(#settingsGrad2)"/>\n' +
        '                            <circle cx="0" cy="0" r="2.5" fill="white"/>\n' +
        '                        </g>\n' +
        '                    </svg>',
    welcome:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                        <circle cx="12" cy="12" r="10" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/>\n' +
        '                        <path d="M12 16v-4M12 8h.01" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>\n' +
        '                    </svg>',
    search:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                        <circle cx="11" cy="11" r="8" stroke="#9ca3af" stroke-width="2" fill="none"/>\n' +
        '                        <path d="M21 21l-4.35-4.35" stroke="#9ca3af" stroke-width="2" stroke-linecap="round"/>\n' +
        '                    </svg>',
    logout:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>\n' +
        '                        <polyline points="16 17 21 12 16 7" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
        '                        <line x1="21" y1="12" x2="9" y2="12" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>\n' +
        '                    </svg>',
    restart:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                        <path d="M23 4v6h-6" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
        '                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
        '                    </svg>',
    shutdown:'<svg viewBox="0 0 24 24" fill="none">\n' +
        '                        <path d="M18.36 6.64a9 9 0 11-12.73 0" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>\n' +
        '                        <line x1="12" y1="2" x2="12" y2="12" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>\n' +
        '                    </svg>',
}

export function getIcon(iconName, size = 24) {
    const icon = Icons[iconName];
    if (!icon) {
        return '';
    }
    return icon.replace(/<svg/, `<svg height="${size}" width="${size}" `);
}