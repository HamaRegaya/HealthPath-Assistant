import unittest
from app import app, mongo
from flask import json
from werkzeug.security import generate_password_hash

class FlaskAppTestCase(unittest.TestCase):
    """
    FlaskAppTestCase
    This class defines a suite of automated tests for a Flask application using the unittest framework.
    It configures a test environment, creates a test database, and exercises various routes
    to validate functionality, including user authentication and conversation management.
    Class Methods:
        setUpClass(cls):
            Prepares the test environment by configuring the Flask app for testing, connecting
            to a test MongoDB instance, and inserting a test user into the database.
        tearDownClass(cls):
            Cleans up the test environment by deleting all documents created during the tests.
    Instance Methods:
        login():
            Logs in the test user via a POST request to the '/login' route.
        test_index():
            Verifies that the home page (index route) is accessible and contains expected content.
        test_register():
            Ensures user registration functions correctly by creating a new user record.
        test_login():
            Checks if the login process succeeds and displays the expected response.
        test_chatbot_access():
            Confirms that logged-in users can access the chatbot route.
        test_logout():
            Verifies that a logged-in user can successfully log out, and that a logout message is displayed.
        test_get_conversations():
            Retrieves and validates the list of conversations for the authenticated user.
        test_save_conversation():
            Sends new conversation data to the server and confirms it is stored correctly.
        test_delete_conversation():
            Creates a conversation for the test user, then deletes it, ensuring removal is successful.
    """

    @classmethod
    def setUpClass(cls):
        """Set up the test client and mock database."""
        app.config['TESTING'] = True
        app.config['MONGO_URI'] = "mongodb://localhost:27017/testdb"  # Use a test database
        cls.client = app.test_client()
        cls.mongo = mongo
        cls.mongo.db.users.delete_many({})  # Clear the test database
        cls.mongo.db.conversations.delete_many({})  # Clear test conversations

        # Insert a test user
        cls.test_user = {
            'first_name': 'Test',
            'last_name': 'User',
            'email': 'test_user@example.com',
            'password': generate_password_hash('password123')  # Hashed password
        }
        cls.mongo.db.users.insert_one(cls.test_user)

    @classmethod
    def tearDownClass(cls):
        """Tear down the test database."""
        cls.mongo.db.users.delete_many({})
        cls.mongo.db.conversations.delete_many({})

    def login(self):
        """Helper method to log in the test user."""
        return self.client.post('/login', data={
            'email': 'test_user@example.com',
            'password': 'password123'
        }, follow_redirects=True)

    def test_index(self):
        """Test the index route."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'notification', response.data)

    def test_register(self):
        """Test user registration."""
        response = self.client.post('/register', data={
            'first_name': 'New',
            'last_name': 'User',
            'phone': '123456789',
            'email': 'new_user@example.com',
            'password': 'securepassword',
            'confirm_password': 'securepassword'
        }, follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Registration successful!', response.data)

        # Check if user exists in the database
        user = self.mongo.db.users.find_one({'email': 'new_user@example.com'})
        self.assertIsNotNone(user)

    def test_login(self):
        """Test user login."""
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Welcome', response.data)

    def test_chatbot_access(self):
        """Test chatbot access for logged-in users."""
        with self.client:
            self.login()  # Log in the test user
            response = self.client.get('/chatbot')
            self.assertEqual(response.status_code, 200)
            self.assertIn(b'chatbot', response.data)

    def test_logout(self):
        """Test user logout."""
        with self.client:
            # Log in the user
            self.login()

            # Log out
            response = self.client.get('/logout', follow_redirects=True)
            self.assertEqual(response.status_code, 200)

            # Check for the flash message in the response
            self.assertIn(b'You have been logged out', response.data)

    def test_get_conversations(self):
        """Test retrieving user conversations."""
        with self.client:
            self.login()  # Log in the test user
            response = self.client.get('/get_conversations')
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertIsInstance(data, list)

    def test_save_conversation(self):
        """Test saving a new conversation."""
        with self.client:
            self.login()  # Log in the test user
            response = self.client.post('/save_conversation', json={
                'title': 'Test Conversation',
                'messages': [{'content': 'Hello', 'role': 'user'}]
            })
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])
            self.assertIn('id', data)

    def test_delete_conversation(self):
        """Test deleting a conversation."""
        with self.client:
            self.login()  # Log in the test user

            # Create a conversation to delete
            conversation = {
                'user_id': str(self.test_user['_id']),
                'title': 'Conversation to Delete',
                'messages': [],
                'timestamp': '2024-01-01T00:00:00Z'
            }
            result = self.mongo.db.conversations.insert_one(conversation)

            # Delete the conversation
            response = self.client.delete(f'/delete_conversation/{str(result.inserted_id)}')
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data['success'])

if __name__ == '__main__':
    unittest.main()
