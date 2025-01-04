import datetime
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_pymongo import PyMongo
from werkzeug.security import generate_password_hash, check_password_hash
from langchain_openai import AzureChatOpenAI 
from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory
from langchain.schema import HumanMessage
from dotenv import load_dotenv
from bson import ObjectId
import os
import base64
from io import BytesIO
from PIL import Image
import httpx

load_dotenv(override=True)

app = Flask(__name__)
app.config['MONGO_URI'] = "mongodb+srv://hamaregaya:b0HtiYL8Ekk1co2q@healthpath.qhccv.mongodb.net/HealthPath?retryWrites=true&w=majority" # Change to your MongoDB connection string
app.config['SECRET_KEY'] = 'a_random_secret_key_123456!@#$%^&*()'

# Initialize MongoDB
mongo = PyMongo(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

print(os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME"))
print(os.getenv("AZURE_OPENAI_ENDPOINT"))
print(os.getenv("AZURE_OPENAI_API_KEY"))
print(os.getenv("AZURE_OPENAI_API_VERSION"))
# Initialize Azure OpenAI
llm = AzureChatOpenAI(
    deployment_name=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    temperature=0
)



# Initialize conversation memory
memory = ConversationBufferMemory()

# Create conversation chain
conversation = ConversationChain(
    llm=llm,
    memory=memory,
    verbose=True
)


# User class for Flask-Login
class User(UserMixin):
    def __init__(self, user_id):
        self.id = user_id


# Flask-Login user loader

@login_manager.user_loader
def load_user(user_id):
    try:
        user_data = mongo.db.users.find_one({"_id": ObjectId(user_id)})
        if user_data:
            return User(user_id=str(user_data["_id"]))  # Return a User object
    except Exception as e:
        print(f"Error loading user: {e}")
    return None

@app.route('/')
def index():
    notification = request.args.get('notification', None)
    notification_type = request.args.get('notification_type', None)
    return render_template('index.html', notification=notification, notification_type=notification_type)


@app.route('/login', methods=['GET', 'POST'])
def login():
    notification = None
    notification_type = None

    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        remember_me = 'remember-me' in request.form

        # Fetch user from MongoDB
        user = mongo.db.users.find_one({"email": email})
        if user and check_password_hash(user['password'], password):
            # Log in the user
            login_user(User(user_id=str(user["_id"])), remember=remember_me)

            # Include the user's name in the notification
            user_name = user.get('first_name', 'User')  # Default to 'User' if 'first_name' is missing
            notification = f"Welcome, {user_name}!"
            return redirect(url_for('index', notification=notification, notification_type="success"))

        # Invalid email or password
        return render_template('login.html', notification="Invalid email or password.", notification_type="error")

    # Render the login page
    notification = request.args.get('notification', None)
    notification_type = request.args.get('notification_type', None)
    return render_template('login.html', notification=notification, notification_type=notification_type)


@app.route('/chat', methods=['GET', 'POST'])
@login_required
def chat():
    if request.method == 'POST':
        message = request.form.get('message', '').strip()
        image = request.files.get('image')

        if not message and not image:
            return jsonify({'response': 'No input provided'}), 400

        try:
            # Create the message content
            if image:
                # Handle image if present
                image_data = base64.b64encode(image.read()).decode('utf-8')
                content = [
                    {"type": "text", "text": message if message else ""},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
                ]
            else:
                content = message

            # Create the message for the AI
            human_message = HumanMessage(content=content)
            
            # Get AI response
            response = llm.invoke([human_message])
            
            if response and hasattr(response, 'content'):
                return jsonify({'response': response.content})
            else:
                return jsonify({'response': 'I apologize, but I could not process your request at this time.'}), 500

        except Exception as e:
            print(f"Error in chat route: {str(e)}")
            return jsonify({'response': 'An error occurred while processing your request.'}), 500

    return render_template('chatbot.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    try:
        if request.method == 'POST':
            first_name = request.form['first_name']
            last_name = request.form['last_name']
            phone = request.form['phone']
            email = request.form['email']
            password = request.form['password']
            confirm_password = request.form['confirm_password']

            # Check if the email is already registered
            if mongo.db.users.find_one({"email": email}):
                return render_template('register.html', notification="Email already registered.", notification_type="error")

            # Validate passwords
            if password != confirm_password:
                return render_template('register.html', notification="Passwords do not match.", notification_type="error")

            # Hash the password
            hashed_password = generate_password_hash(password, method='pbkdf2:sha256')

            # Insert the user into the users collection
            mongo.db.users.insert_one({
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone,
                "email": email,
                "password": hashed_password
            })

            # Redirect to the login page with a success notification
            return redirect(url_for('login', notification="Registration successful!", notification_type="success"))

        return render_template('register.html')
    except Exception as e:
        print(f"Error during registration: {e}")  # Log the error for debugging
        return render_template('404.html', notification="An error occurred. Please try again.", notification_type="error")



@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/chart')
def chart():
    return render_template('chart-and-report.html')

@app.route('/chatbot')
@login_required
def chatbot():
    return render_template('chatbot.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('login'))

@app.route('/get_conversations')
@login_required
def get_conversations():
    user_conversations = list(mongo.db.conversations.find({'user_id': str(current_user.id)}))
    conversations_list = []
    
    for conv in user_conversations:
        conversations_list.append({
            'id': str(conv['_id']),
            'title': conv.get('title', 'New Conversation'),
            'timestamp': conv.get('timestamp', datetime.datetime.now()).isoformat()
        })
    
    if not conversations_list:
        new_conv = {
            'user_id': str(current_user.id),
            'title': 'New Conversation',
            'messages': [],
            'timestamp': datetime.datetime.now()
        }
        result = mongo.db.conversations.insert_one(new_conv)
        conversations_list.append({
            'id': str(result.inserted_id),
            'title': new_conv['title'],
            'timestamp': new_conv['timestamp'].isoformat()
        })
    
    return jsonify(conversations_list)

@app.route('/get_conversation/<conversation_id>')
@login_required
def get_conversation(conversation_id):
    conversation = mongo.db.conversations.find_one({
        '_id': ObjectId(conversation_id),
        'user_id': str(current_user.id)
    })
    
    if conversation:
        return jsonify({
            'id': str(conversation['_id']),
            'title': conversation.get('title', 'New Conversation'),
            'messages': conversation.get('messages', [])
        })
    return jsonify({'error': 'Conversation not found'}), 404

@app.route('/save_conversation', methods=['POST'])
@login_required
def save_conversation():
    data = request.json
    conversation_id = data.get('id')
    title = data.get('title', 'New Conversation')
    messages = data.get('messages', [])
    
    if conversation_id:
        # Update existing conversation
        result = mongo.db.conversations.update_one(
            {'_id': ObjectId(conversation_id), 'user_id': str(current_user.id)},
            {'$set': {
                'title': title,
                'messages': messages,
                'timestamp': datetime.datetime.now()
            }}
        )
        if result.matched_count == 0:
            return jsonify({'error': 'Conversation not found'}), 404
    else:
        # Create new conversation
        conversation = {
            'user_id': str(current_user.id),
            'title': title,
            'messages': messages,
            'timestamp': datetime.datetime.now()
        }
        result = mongo.db.conversations.insert_one(conversation)
        conversation_id = str(result.inserted_id)
    
    return jsonify({'success': True, 'id': conversation_id})

@app.route('/delete_conversation/<conversation_id>', methods=['DELETE'])
@login_required
def delete_conversation(conversation_id):
    result = mongo.db.conversations.delete_one({
        '_id': ObjectId(conversation_id),
        'user_id': str(current_user.id)
    })
    return jsonify({'success': True if result.deleted_count > 0 else False})

if __name__ == '__main__':
    app.run(debug=True)