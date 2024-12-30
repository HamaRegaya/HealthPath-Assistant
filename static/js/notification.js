document.addEventListener('DOMContentLoaded', function () {
    const notification = document.querySelector('.notification-container');
    if (!notification) return; // Exit if there's no notification

    const closeButton = document.querySelector('.notification-close');
    const notificationType = notification.querySelector('.notification').getAttribute('data-type');
    const iconElement = notification.querySelector('.notification-icon i');

    // Function to update the notification icon dynamically
    function updateNotificationIcon(type) {
        switch (type) {
            case 'success':
                iconElement.className = 'fas fa-check';
                break;
            case 'error':
                iconElement.className = 'fas fa-times';
                break;
            case 'info':
                iconElement.className = 'fas fa-info';
                break;
            default:
                iconElement.className = ''; // Clear icon if type is not recognized
                break;
        }
    }

    // Update the icon based on the notification type
    updateNotificationIcon(notificationType);

    // Close notification when clicking the close button
    closeButton.addEventListener('click', function () {
        notification.style.animation = 'slideOut 0.5s ease-in-out forwards';
        setTimeout(() => {
            notification.remove();
        }, 500);
    });

    // Automatically close after 3 seconds
    setTimeout(() => {
        if (notification) {
            notification.style.animation = 'slideOut 0.5s ease-in-out forwards';
            setTimeout(() => {
                notification.remove();
            }, 500);
        }
    }, 4000);
});
