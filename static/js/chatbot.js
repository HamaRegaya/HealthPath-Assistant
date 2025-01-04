$(document).ready(function() {
    // Configure marked.js
    marked.setOptions({
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
                        updateConversationTitle(conversationId, newTitle);
                    }
                }
            })
            .on('blur', function() {
                const newTitle = $(this).val().trim();
                if (newTitle) {
                    titleSpan.text(newTitle);
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
            setTimeout(() => typeMessage(element, text, index + 1), 10);
        }
    }

    // Function to add a message to the chat
    function addMessage(message, isUser = false, imageUrl = null) {
        const messageDiv = $('<div>')
            .addClass('message')
            .addClass(isUser ? 'message-user' : 'message-bot')
            .addClass('message-hidden');
    
        if (!isUser) {
            const typingIndicator = $('<div class="typing-indicator"><span></span><span></span><span></span></div>');
            chatMessages.append(typingIndicator);
            chatMessages.scrollTop(chatMessages[0].scrollHeight);
    
            setTimeout(() => {
                typingIndicator.remove();
                chatMessages.append(messageDiv);
                messageDiv.removeClass('message-hidden');
                typeMessage(messageDiv, message);
                chatMessages.scrollTop(chatMessages[0].scrollHeight);
            }, 500);
        } else {
            if (imageUrl) {
                const imagePreview = $('<img>')
                    .addClass('message-image-preview')
                    .attr('src', imageUrl)
                    .attr('alt', 'Uploaded image');
                chatMessages.append(imagePreview);
            }
    
            messageDiv.text(message);
            chatMessages.append(messageDiv);
    
            setTimeout(() => messageDiv.removeClass('message-hidden'), 50);
            chatMessages.scrollTop(chatMessages[0].scrollHeight);
        }
    }

    // Function to clear chat messages
    function clearChat(showWelcome = true) {
        $('#chat-messages').empty();
        if (showWelcome) {
            addMessage("Hello! I'm your diabetes management assistant. How can I help you today?", false);
        }
    }

    let currentConversationId = null;
    const chatHistoryContainer = $('.chat-sidebar');

    // Load conversations from the server
    function loadConversations() {
        $.get('/get_conversations')
            .done(function(conversations) {
                $('.chat-history').remove();
                
                conversations.forEach(function(conv) {
                    const chatItem = createChatHistoryItem(conv.title);
                    chatItem.attr('data-conversation-id', conv.id);
                    chatItem.insertAfter('.sidebar-header');
                });

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
            const isUser = $(this).hasClass('message-user');
            const messageContent = $(this).text().trim();
            const imageUrl = $(this).prev('.message-image-preview').attr('src');
            
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

        // Only save if there are messages and we have a current conversation
        if (messages.length > 0 && currentConversationId) {
            // Prepare conversation data
            const conversationData = {
                id: currentConversationId,
                title: $('.chat-history.active .chat-title').text() || 'New Conversation',
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
                        loadConversations();
                    }
                },
                error: function(error) {
                    console.error('Error saving conversation:', error);
                }
            });
        }
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
                title: newTitle,
                updateTitleOnly: true
            })
        }).fail(function(error) {
            console.error('Error updating conversation title:', error);
        });
    }

    // Load conversation messages
    function loadConversation(conversationId) {
        if (currentConversationId === conversationId) return;
        
        $.get('/get_conversation/' + conversationId)
            .done(function(conversation) {
                clearChat(false);
                currentConversationId = conversation.id;
                
                // Highlight the selected conversation
                $('.chat-history').removeClass('active');
                $('.chat-history[data-conversation-id="' + conversationId + '"]').addClass('active');
                
                if (conversation.messages && conversation.messages.length > 0) {
                    conversation.messages.forEach(function(msg) {
                        const isUser = msg.role === 'user';
                        if (msg.image) {
                            // If message has an image, display it first
                            addMessage(msg.content || '', isUser, msg.image);
                        } else {
                            // Text-only message
                            addMessage(msg.content, isUser);
                        }
                    });
                } else {
                    // Only show welcome message if there are no messages
                    addMessage("Hello! I'm your diabetes management assistant. How can I help you today?", false);
                }
            })
            .fail(function(error) {
                console.error('Error loading conversation:', error);
                clearChat(true); // Show welcome message on error
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

    // Event handlers for chat history interactions
    $(document).on('click', '.chat-history', function(e) {
        if (!$(e.target).closest('.chat-actions').length) {
            const conversationId = $(this).attr('data-conversation-id');
            if (conversationId) {
                $('.chat-history').removeClass('active');
                $(this).addClass('active');
                loadConversation(conversationId);
            }
        }
    });

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

    $(document).on('click', '.edit-title-btn', function(e) {
        e.stopPropagation();
        const chatHistoryItem = $(this).closest('.chat-history');
        makeEditable(chatHistoryItem);
    });

    // Handle chat form submission
    chatForm.submit(function(e) {
        e.preventDefault();
        const message = userInput.val().trim();
        const imageFile = imageInput[0].files[0];
        
        if (!message && !imageFile) return;

        userInput.val('');
        
        const formData = new FormData();
        if (message) formData.append('message', message);
        if (imageFile) formData.append('image', imageFile);
        if (currentConversationId) formData.append('conversationId', currentConversationId);

        if (imageFile) {
            const reader = new FileReader();
            reader.onload = function(e) {
                addMessage(message || '', true, e.target.result);
            }
            reader.readAsDataURL(imageFile);
        } else if (message) {
            addMessage(message, true);
        }

        $('.image-preview').attr('src', '');
        $('.image-preview-container').hide();
        $('#image-input').val('');

        $.ajax({
            url: '/chat',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.response) {
                    addMessage(response.response, false);
                }
            },
            error: function(error) {
                console.error('Error:', error);
                addMessage('Sorry, there was an error processing your message.', false);
            }
        });
    });

    // Image handling
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

    $('.delete-image').click(function() {
        $('.image-preview').attr('src', '');
        $('.image-preview-container').hide();
        $('#image-input').val('');
    });

    // Speech recognition setup
    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        let isRecording = false;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        $('#start-btn').click(function() {
            if (!isRecording) {
                recognition.start();
                $(this).css('color', '#ff0000');
            } else {
                recognition.stop();
                $(this).css('color', '');
            }
            isRecording = !isRecording;
        });

        recognition.onresult = function(event) {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
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
                recognition.start();
            } else {
                $('#start-btn').css('color', '');
            }
        };
    } else {
        $('#start-btn').parent().hide();
        console.warn("Speech Recognition is not supported in this browser");
    }
});