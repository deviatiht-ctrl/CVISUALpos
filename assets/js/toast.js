/**
 * CVISUAL POS — toast.js
 * Système de notifications toast élégant et moderne.
 * Zéro alert(), micro-animations fluides, icônes Lucide.
 */

let container = null;

function ensureContainer() {
    if (!container) {
        container = document.getElementById('cvisual-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'cvisual-toast-container';
            container.style.cssText = `
                position: fixed;
                top: 24px;
                right: 24px;
                z-index: 999999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
                max-width: 420px;
                width: calc(100vw - 48px);
            `;
            document.body.appendChild(container);
        }
    }
    return container;
}

export function showToast({ title, message = '', type = 'info', duration = 4000, action = null }) {
    const parent = ensureContainer();

    const toast = document.createElement('div');
    toast.className = `cvisual-toast cvisual-toast-${type}`;
    toast.style.cssText = `
        pointer-events: auto;
        background: #FFFFFF;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-left: 4px solid ${
            type === 'success' ? '#10B981' :
            type === 'error' ? '#EF4444' :
            type === 'warning' ? '#F59E0B' : '#F97316'
        };
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.06);
        padding: 14px 18px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        transform: translateY(-20px);
        opacity: 0;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'DM Sans', -apple-system, sans-serif;
    `;

    const iconMap = {
        success: 'check-circle-2',
        error: 'alert-circle',
        warning: 'alert-triangle',
        info: 'info'
    };

    const iconColorMap = {
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#F97316'
    };

    const iconName = iconMap[type] || 'info';
    const iconColor = iconColorMap[type] || '#F97316';

    toast.innerHTML = `
        <div style="flex-shrink: 0; margin-top: 2px;">
            <i data-lucide="${iconName}" style="width: 20px; height: 20px; color: ${iconColor};"></i>
        </div>
        <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 14px; color: #1B2A4A; line-height: 1.3;">
                ${title}
            </div>
            ${message ? `<div style="font-size: 13px; color: #64748B; margin-top: 3px; line-height: 1.4;">${message}</div>` : ''}
        </div>
        <button type="button" class="toast-close" style="background: none; border: none; cursor: pointer; padding: 2px; color: #94A3B8; display: flex; align-items: center; justify-content: center;">
            <i data-lucide="x" style="width: 16px; height: 16px;"></i>
        </button>
    `;

    parent.appendChild(toast);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: toast });
    }

    // Animation entrée
    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
        toast.style.transform = 'translateY(-15px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 250);
    };

    if (closeBtn) closeBtn.onclick = dismiss;

    if (duration > 0) {
        setTimeout(dismiss, duration);
    }

    return { dismiss };
}

export const toast = {
    success: (title, message, duration) => showToast({ title, message, type: 'success', duration }),
    error: (title, message, duration) => showToast({ title, message, type: 'error', duration }),
    warning: (title, message, duration) => showToast({ title, message, type: 'warning', duration }),
    info: (title, message, duration) => showToast({ title, message, type: 'info', duration })
};

window.toast = toast;
