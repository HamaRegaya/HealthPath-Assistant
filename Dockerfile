# Use a base image with Python and Flask pre-installed for Linux
FROM python:3.10.8

# Set the working directory within the container
WORKDIR /app

# Copy the requirements.txt file and install dependencies
COPY requirements.txt requirements.txt

# Install audio system libraries
RUN apt-get update && apt-get install -y libasound2 libasound2-dev portaudio19-dev

# Reinstall requirements from requirements.txt
RUN pip install -r requirements.txt

# Copy the rest of your application code
COPY . .

# Expose the port your Flask app will run on
EXPOSE 5000

# Define the command to run your application
CMD ["python", "run.py"]