/**
 * D.U.B.I.A. — Notification System
 * Industrial toast notifications with auto-dismiss
 */

'use strict';

const showNotification = (title, message, type = 'info', duration = 4000) => {
    const area = document.getElementById('notificationArea');
    if (!area) return;

    const icons = {
        success: '✅', warning: '⚠️', error: '❌',
        info: 'ℹ️', alert: '🚨'
    };

    // Map legacy types
    const normalizedType = (type === 'alert') ? 'error' : type;

    const notification = document.createElement('div');
    notification.className = `notification ${normalizedType}`;
    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <div class="notification-body">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
    `;

    area.appendChild(notification);

    // Auto-dismiss
    setTimeout(() => {
        notification.classList.add('closing');
        setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 250);
    }, duration);
};
