$(document).ready(function() {
    // Configure marked.js
    // marked.setOptions({
    //     highlight: function(code, language) {
    //         if (language && hljs.getLanguage(language)) {
    //             return hljs.highlight(code, { language: language }).value;
    //         }
    //         return hljs.highlightAuto(code).value;
    //     },
    //     breaks: true,
    //     gfm: true
    // });

    // Sidebar toggle functionality
    $('.toggle-sidebar').click(function() {
        $('.chat-sidebar').toggleClass('hidden');        
        $(this).find('i').toggleClass('fa-chevron-left fa-chevron-right');
    });

    const chatMessages = $('#chat-messages');
    const chatForm = $('#chat-form');
    const userInput = $('#user-input');
    const imageInput = $('#image-input');

    // Function to create editable chat history item
    function createChatHistoryItem(title) {
        return $('<div>').addClass('chat-history').html(`
            <i class="fa fa-comments-o"></i>
            <span class="chat-title">${title}</span>
            <div class="chat-actions">
                <button class="edit-title-btn">
                    <i class="fa fa-pencil"></i>
                </button>
                <button class="delete-chat-btn">
                    <i class="fa fa-trash"></i>
                </button>
            </div>
        `);
    }

    // Function to make title editable
    function makeEditable(chatHistoryItem) {
        const titleSpan = chatHistoryItem.find('.chat-title');
        const currentTitle = titleSpan.text();
        
        // Create input field
        const input = $('<input>')
            .addClass('edit-title-input')
            .val(currentTitle)
            .on('keypress', function(e) {
                if (e.which === 13) { // Enter key
                    const newTitle = $(this).val().trim();
                    if (newTitle) {
                        titleSpan.text(newTitle);
                        input.remove();
                        titleSpan.show();
                    }
                }
            })
            .on('blur', function() {
                const newTitle = $(this).val().trim();
                if (newTitle) {
                    titleSpan.text(newTitle);
                }
                input.remove();
                titleSpan.show();
            });

        titleSpan.hide();
        input.insertAfter(titleSpan);
        input.focus();
    }
    function renderMarkdown(markdown) {
        return marked(markdown);
    }   
    // Function to simulate typing effect
    function typeMessage(element, text, index = 0) {
        if (index < text.length) {
            let currentText = text.substring(0, index + 1);
            element.html(renderMarkdown(currentText));
            setTimeout(() => typeMessage(element, text, index + 1), 10); // Faster typing speed
        }
    }

    // Function to add a message to the chat
    function addMessage(message, isUser = false, imageUrl = null) {
        // Create the message container
        const messageDiv = $('<div>')
            .addClass('message')
            .addClass(isUser ? 'message-user' : 'message-bot')
            .addClass('message-hidden');
    
        if (!isUser) {
            // Add typing indicator immediately
            const typingIndicator = $('<div class="typing-indicator"><span></span><span></span><span></span></div>');
            chatMessages.append(typingIndicator);
            chatMessages.scrollTop(chatMessages[0].scrollHeight);
    
            // Start typing after a brief delay
            setTimeout(() => {
                typingIndicator.remove();
                chatMessages.append(messageDiv);
                messageDiv.removeClass('message-hidden');
                typeMessage(messageDiv, message);
                chatMessages.scrollTop(chatMessages[0].scrollHeight);
            }, 500); // Reduced delay before typing starts
        } else {
            // If there's an image, append it above the message div
            if (imageUrl) {
                const imagePreview = $('<img>')
                    .addClass('message-image-preview')
                    .attr('src', imageUrl)
                    .attr('alt', 'Uploaded image');
                chatMessages.append(imagePreview); // Append the image directly to the chat container
            }
    
            // Add the message
            messageDiv.text(message);
            chatMessages.append(messageDiv);
    
            // Reveal the message with animation
            setTimeout(() => messageDiv.removeClass('message-hidden'), 50);
            chatMessages.scrollTop(chatMessages[0].scrollHeight);
        }
    }
     

    // Function to clear chat messages
    function clearChat() {
        chatMessages.empty();
        addMessage("Hello! I'm your diabetes management assistant. How can I help you today?", false);
    }

    // Handle new chat button click
    $('#new-chat-btn').click(function() {
        clearChat();
        // Add the new chat to history
        const newChatHistory = createChatHistoryItem('New Chat');
        // Insert after the sidebar header
        newChatHistory.insertAfter('.sidebar-header');
    });

    // Handle edit button click (for dynamically added elements)
    $(document).on('click', '.edit-title-btn', function(e) {
        e.stopPropagation();
        const chatHistoryItem = $(this).closest('.chat-history');
        makeEditable(chatHistoryItem);
    });

    // Handle delete button click
    $(document).on('click', '.delete-chat-btn', function(e) {
        e.stopPropagation();
        const chatHistoryItem = $(this).closest('.chat-history');
        
        // Add fade out animation before removing
        chatHistoryItem.animate({
            opacity: 0,
            height: 0,
            marginBottom: 0,
            padding: 0
        }, 200, function() {
            $(this).remove();
        });
    });

    // Update existing chat history items to have edit and delete buttons
    $('.chat-history').each(function() {
        const title = $(this).find('span').text();
        $(this).html(`
            <i class="fa fa-comments-o"></i>
            <span class="chat-title">${title}</span>
            <div class="chat-actions">
                <button class="edit-title-btn">
                    <i class="fa fa-pencil"></i>
                </button>
                <button class="delete-chat-btn">
                    <i class="fa fa-trash"></i>
                </button>
            </div>
        `);
    });

    // Add initial bot message
    addMessage("Hello! I'm your diabetes management assistant. How can I help you today?", false);

    // Handle form submission
    chatForm.on('submit', function (e) {
        e.preventDefault();
        const message = userInput.val().trim();
        const imageFile = imageInput[0].files[0];
    
        if (message || imageFile) {
            // Clear inputs immediately
            userInput.val('');
            const imageUrl = $('.image-preview').attr('src');
            $('#image-input').val(''); // Clear image input
            $('.image-preview').attr('src', ''); // Reset preview
            $('.image-preview-container').hide(); // Hide preview container
    
            // Add user message with optional image
            if (message || imageUrl) {
                addMessage(message, true, imageUrl);
            }
    
            // Prepare form data
            const formData = new FormData();
            if (message) formData.append('message', message);
            if (imageFile) formData.append('image', imageFile);
    
            // Show typing indicator immediately for bot response
            $.ajax({
                url: '/chat',
                method: 'POST',
                processData: false,
                contentType: false,
                data: formData,
                success: function (response) {
                    // Add bot response
                    addMessage(response.response, false);
                },
                error: function (error) {
                    console.error('Error:', error);
                    addMessage('Sorry, there was an error processing your request.', false);
                }
            });
        }
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

    // Speech recognition
    if (!('webkitSpeechRecognition' in window)) {
        $('#start-btn').parent().hide();
        console.warn("Speech Recognition is not supported in this browser");
    } else {
        const recognition = new webkitSpeechRecognition();
        let isRecording = false;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        $('#start-btn').click(function() {
            if (!isRecording) {
                recognition.start();
                $(this).css('color', '#ff0000'); // Red color when recording
            } else {
                recognition.stop();
                $(this).css('color', ''); // Reset color
            }
            isRecording = !isRecording;
        });

        recognition.onresult = function(event) {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                userInput.val(userInput.val() + finalTranscript);
            }
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            $('#start-btn').css('color', '');
            isRecording = false;
        };

        recognition.onend = function() {
            if (isRecording) {
                recognition.start(); // Restart if we're still supposed to be recording
            } else {
                $('#start-btn').css('color', '');
            }
        };
    }
});