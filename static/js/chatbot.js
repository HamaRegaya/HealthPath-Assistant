$(document).ready(function() {
    $('.toggle-sidebar').click(function() {
        $('.chat-sidebar').toggleClass('hidden');        
        // Toggle the icon on the button
        $(this).find('i').toggleClass('fa-chevron-left fa-chevron-right');
    });
});