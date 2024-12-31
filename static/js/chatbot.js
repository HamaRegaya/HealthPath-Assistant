$(document).ready(function() {
    // Configure marked.js
    marked.setOptions({
        highlight: function(code, language) {
            if (language && hljs.getLanguage(language)) {
                return hljs.highlight(code, { language: language }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true
    });

    // Sidebar toggle functionality
    $('.toggle-sidebar').click(function() {
        $('.chat-sidebar').toggleClass('hidden');        
        $(this).find('i').toggleClass('fa-chevron-left fa-chevron-right');
    });

    const chatMessages = $('#chat-messages');
    const chatForm = $('#chat-form');
    const userInput = $('#user-input');

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

    // Function to safely render markdown
    function renderMarkdown(text) {
        try {
            return marked.parse(text);
        } catch (e) {
            console.error('Markdown parsing error:', e);
            return text;
        }
    }

    // Function to add a message to the chat
    function addMessage(message, isUser = false) {
        const messageDiv = $('<div>').addClass('message').addClass(isUser ? 'message-user' : 'message-bot');
        
        if (isUser) {
            messageDiv.text(message);
        } else {
            // For bot messages, render markdown
            messageDiv.html(renderMarkdown(message));
            
            // Initialize syntax highlighting for code blocks
            messageDiv.find('pre code').each(function(i, block) {
                hljs.highlightBlock(block);
            });
        }
        
        chatMessages.append(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop(chatMessages[0].scrollHeight);
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
    chatForm.on('submit', function(e) {
        e.preventDefault();
        
        const message = userInput.val().trim();
        if (!message) return;

        // Add user message to chat
        addMessage(message, true);
        
        // Clear input
        userInput.val('');

        // Send message to backend
        $.ajax({
            url: '/chat',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ message: message }),
            success: function(response) {
                // Add bot response to chat
                addMessage(response.response, false);
            },
            error: function(error) {
                console.error('Error:', error);
                addMessage("I'm sorry, I encountered an error. Please try again.", false);
            }
        });
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