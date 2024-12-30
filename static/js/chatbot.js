$(document).ready(function() {
    // Sidebar toggle functionality
    $('.toggle-sidebar').click(function() {
        $('.chat-sidebar').toggleClass('hidden');        
        $(this).find('i').toggleClass('fa-chevron-left fa-chevron-right');
    });

    // Image upload handling
    $('#image-input').change(function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                $('.image-preview').attr('src', e.target.result);
                $('.image-preview-container').show();
            }
            reader.readAsDataURL(file);
        }
    });

    // Delete image functionality
    $('.delete-image').click(function() {
        $('.image-preview').attr('src', '');
        $('.image-preview-container').hide();
        $('#image-input').val('');
    });
});