from flask import Flask, render_template, request, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_pymongo import PyMongo
from werkzeug.security import generate_password_hash, check_password_hash
# from openai import AzureOpenAI
from langchain_openai import AzureChatOpenAI 
from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
app.config['MONGO_URI'] = "mongodb+srv://hamaregaya:b0HtiYL8Ekk1co2q@healthpath.qhccv.mongodb.net/HealthPath?retryWrites=true&w=majority" # Change to your MongoDB connection string
app.config['SECRET_KEY'] = 'a_random_secret_key_123456!@#$%^&*()'

# Initialize MongoDB
mongo = PyMongo(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

AZURE_OPENAI_API_KEY = ".."
AZURE_OPENAI_ENDPOINT = ".."
AZURE_OPENAI_API_VERSION = ".."
AZURE_OPENAI_CHAT_DEPLOYMENT_NAME= ".."

os.environ["OPENAI_API_KEY"] = AZURE_OPENAI_API_KEY
os.environ["OPENAI_API_BASE"] = AZURE_OPENAI_ENDPOINT
os.environ["OPENAI_API_VERSION"] = AZURE_OPENAI_API_VERSION
os.environ["OPENAI_DEPLOYMENT_NAME"] = AZURE_OPENAI_CHAT_DEPLOYMENT_NAME

# Initialize Azure OpenAI
llm = AzureChatOpenAI(
    deployment_name=os.environ["OPENAI_DEPLOYMENT_NAME"],
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
    user_data = mongo.db.users.find_one({"_id": user_id})
    if user_data:
        return User(user_id)
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


@app.route('/chat', methods=['POST'])
def chat():
    user_input = request.json['message']
    response = conversation.predict(input=user_input)
    return jsonify({'response': response})


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
def chatbot():
    return render_template('chatbot.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(debug=True)