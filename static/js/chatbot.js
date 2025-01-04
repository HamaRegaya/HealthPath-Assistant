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
        const conversationId = chatHistoryItem.attr('data-conversation-id');
        
        // Create input field
        const input = $('<input>')
            .addClass('edit-title-input')
            .val(currentTitle)
            .on('keypress', function(e) {
                if (e.which === 13) { // Enter key
                    const newTitle = $(this).val().trim();
                    if (newTitle) {
                        titleSpan.text(newTitle);
                        $(this).remove();
                        titleSpan.show();
                        
                        // Save the new title to database
                        updateConversationTitle(conversationId, newTitle);
                    }
                }
            })
            .on('blur', function() {
                const newTitle = $(this).val().trim();
                if (newTitle) {
                    titleSpan.text(newTitle);
                    // Save the new title to database
                    updateConversationTitle(conversationId, newTitle);
                }
                $(this).remove();
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
        const messageDiv = $('<div>').addClass('message').addClass(isUser ? 'user-message' : 'assistant-message');
        
        // Create message content wrapper
        const contentWrapper = $('<div>').addClass('message-content-wrapper');
        
        // Add avatar
        const avatar = $('<div>').addClass('message-avatar');
        avatar.html(`<i class="fa ${isUser ? 'fa-user' : 'fa-robot'}"></i>`);
        contentWrapper.append(avatar);
        
        // Create message content
        const contentDiv = $('<div>').addClass('message-content');
        
        // Add text content
        if (message && message.trim() !== '') {
            const textContent = $('<p>').text(message);
            contentDiv.append(textContent);
        }
        
        // Add image if provided
        if (imageUrl) {
            const img = $('<img>').attr('src', imageUrl).addClass('message-image');
            contentDiv.append(img);
        }
        
        contentWrapper.append(contentDiv);
        messageDiv.append(contentWrapper);
        
        // Add timestamp
        const timestamp = $('<div>').addClass('message-timestamp').text(new Date().toLocaleTimeString());
        messageDiv.append(timestamp);
        
        chatMessages.append(messageDiv);
        chatMessages.scrollTop(chatMessages[0].scrollHeight);
        
        // Save conversation after adding message
        saveCurrentConversation();
    }

    // Function to clear chat messages
    function clearChat() {
        $('#chat-messages').empty();
        addMessage("Hello! I'm your diabetes management assistant. How can I help you today?", false);
    }

    let currentConversationId = null;
    const chatHistoryContainer = $('.chat-sidebar');

    // Load conversations from the server
    function loadConversations() {
        $.get('/get_conversations')
            .done(function(conversations) {
                // Clear existing conversations except the header
                $('.chat-history').remove();
                
                conversations.forEach(function(conv) {
                    const chatItem = createChatHistoryItem(conv.title);
                    chatItem.attr('data-conversation-id', conv.id);
                    chatItem.insertAfter('.sidebar-header');
                });

                // If this is the first load and no conversation is selected, load the first one
                if (!currentConversationId && conversations.length > 0) {
                    loadConversation(conversations[0].id);
                }
            })
            .fail(function(error) {
                console.error('Error loading conversations:', error);
            });
    }

    // Load conversations on page load
    loadConversations();

    // Save current conversation
    function saveCurrentConversation() {
        // Collect all messages from the chat
        const messages = [];
        $('#chat-messages .message').each(function() {
            const isUser = $(this).hasClass('user-message');
            const messageContent = $(this).find('.message-content p').text().trim();
            const imageUrl = $(this).find('.message-image').attr('src');
            
            // Only add message if there's content or an image
            if (messageContent || imageUrl) {
                const messageObj = {
                    role: isUser ? 'user' : 'assistant',
                    content: messageContent || ''
                };
                
                if (imageUrl) {
                    messageObj.image = imageUrl;
                }
                
                messages.push(messageObj);
            }
        });

        // Only save if there are messages
        if (messages.length > 0) {
            // Prepare conversation data
            const conversationData = {
                id: currentConversationId,
                title: $('.chat-title').first().text() || 'New Conversation',
                messages: messages
            };

            // Send to server
            $.ajax({
                url: '/save_conversation',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(conversationData),
                success: function(response) {
                    if (response.id && !currentConversationId) {
                        currentConversationId = response.id;
                        loadConversations(); // Refresh the conversation list
                    }
                },
                error: function(error) {
                    console.error('Error saving conversation:', error);
                }
            });
        }
    }

    // Load conversation messages
    function loadConversation(conversationId) {
        if (currentConversationId === conversationId) return; // Don't reload if already selected
        
        $.get('/get_conversation/' + conversationId)
            .done(function(conversation) {
                clearChat();
                currentConversationId = conversation.id;
                
                // Highlight the selected conversation
                $('.chat-history').removeClass('active');
                $('.chat-history[data-conversation-id="' + conversationId + '"]').addClass('active');
                
                if (conversation.messages && conversation.messages.length > 0) {
                    $('#chat-messages').empty(); // Clear the welcome message
                    conversation.messages.forEach(function(msg) {
                        addMessage(msg.content, msg.isUser);
                    });
                }
            })
            .fail(function(error) {
                console.error('Error loading conversation:', error);
                clearChat();
            });
    }

    // Function to update conversation title in database
    function updateConversationTitle(conversationId, newTitle) {
        if (!conversationId) return;

        $.ajax({
            url: '/save_conversation',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                id: conversationId,
                title: newTitle
            })
        }).fail(function(error) {
            console.error('Error updating conversation title:', error);
        });
    }

    // Handle new chat button click
    $('#new-chat-btn').click(function() {
        $.ajax({
            url: '/save_conversation',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                title: 'New Chat'
            })
        })
        .done(function(response) {
            currentConversationId = response.id;
            loadConversations();
            clearChat();
        })
        .fail(function(error) {
            console.error('Error creating New Chat:', error);
        });
    });

    // Handle chat history item click
    $(document).on('click', '.chat-history', function(e) {
        if (!$(e.target).closest('.chat-actions').length) {
            const conversationId = $(this).attr('data-conversation-id');
            if (conversationId) {
                // Remove active class from all conversations
                $('.chat-history').removeClass('active');
                // Add active class to clicked conversation
                $(this).addClass('active');
                loadConversation(conversationId);
            }
        }
    });

    // Handle delete chat button click
    $(document).on('click', '.delete-chat-btn', function(e) {
        e.stopPropagation();
        const chatItem = $(this).closest('.chat-history');
        const conversationId = chatItem.attr('data-conversation-id');

        if (conversationId) {
            $.ajax({
                url: '/delete_conversation/' + conversationId,
                method: 'DELETE'
            })
            .done(function() {
                chatItem.fadeOut(200, function() {
                    $(this).remove();
                    if (conversationId === currentConversationId) {
                        clearChat();
                        currentConversationId = null;
                    }
                    // If no conversations left, load conversations to get the default one
                    if ($('.chat-history').length === 0) {
                        loadConversations();
                    }
                });
            })
            .fail(function(error) {
                console.error('Error deleting conversation:', error);
            });
        }
    });

    // Save conversation after each message
    const originalAddMessage = addMessage;
    addMessage = function(message, isUser = false, imageUrl = null) {
        originalAddMessage(message, isUser, imageUrl);
        if (currentConversationId) {
            saveCurrentConversation();
        }
    };

    // Save conversation periodically
    setInterval(saveCurrentConversation, 30000);

    // Handle edit button click (for dynamically added elements)
    $(document).on('click', '.edit-title-btn', function(e) {
        e.stopPropagation();
        const chatHistoryItem = $(this).closest('.chat-history');
        makeEditable(chatHistoryItem);
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
    // addMessage("Hello! I'm your diabetes management assistant. How can I help you today?", false);

    // Handle chat form submission
    chatForm.on('submit', function(e) {
        e.preventDefault();
        const message = userInput.val().trim();
        const imageFile = imageInput[0].files[0];

        if (!message && !imageFile) return;

        if (imageFile) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imageUrl = e.target.result;
                addMessage(message, true, imageUrl);
                // Clear the image input
                imageInput.val('');
                
                // Save conversation after adding the message
                saveCurrentConversation();
            };
            reader.readAsDataURL(imageFile);
        } else if (message) {
            addMessage(message, true);
            
            // Make the API call
            $.ajax({
                url: '/chat',
                method: 'POST',
                data: {
                    message: message
                },
                success: function(response) {
                    addMessage(response.response, false);
                    userInput.val('');
                    
                    // Save conversation after receiving the response
                    saveCurrentConversation();
                },
                error: function(error) {
                    console.error('Error:', error);
                    addMessage('Sorry, there was an error processing your request.', false);
                    
                    // Save conversation even if there was an error
                    saveCurrentConversation();
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