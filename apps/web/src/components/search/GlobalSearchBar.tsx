'use client';

export function GlobalSearchBar() {
    return (
        <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            style={{
                display: 'flex', alignItems: 'center',
                background: '#F4F5F7', border: '1px solid #DFE1E6',
                borderRadius: '6px', padding: '6px 12px',
                width: '100%', maxWidth: '300px', cursor: 'text',
                color: '#6B778C', transition: 'border 0.2s, background 0.2s',
            }}
            onMouseOver={e => {
                e.currentTarget.style.background = '#EBECF0';
                e.currentTarget.style.borderColor = '#C1C7D0';
            }}
            onMouseOut={e => {
                e.currentTarget.style.background = '#F4F5F7';
                e.currentTarget.style.borderColor = '#DFE1E6';
            }}
            aria-label="Search"
        >
            <span style={{ fontSize: 14, marginRight: 8 }}>🔍</span>
            <span style={{ fontSize: 13, flex: 1, textAlign: 'left' }}>Search VaultStack...</span>
            <div style={{
                display: 'flex', alignItems: 'center',
                background: '#FFFFFF', border: '1px solid #DFE1E6',
                borderRadius: '4px', padding: '2px 6px',
                fontSize: 11, fontWeight: 600, color: '#5E6C84'
            }}>
                ⌘K
            </div>
        </button>
    );
}
