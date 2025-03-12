 # To check wether the email is sending properly or not 
import os, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

sender_email = os.getenv("EMAIL_USER")
sender_password = os.getenv("EMAIL_PASS")
smtp_server = os.getenv("SMTP_SERVER")
smtp_port = int(os.getenv("SMTP_PORT", 2525))

recipient_email = "test@example.com"  # Use your own email for testing
subject = "Test Email from Mailtrap"
body = "This is a test email."

msg = MIMEMultipart()
msg["From"] = sender_email
msg["To"] = recipient_email
msg["Subject"] = subject
msg.attach(MIMEText(body, "plain"))

try:
    server = smtplib.SMTP(smtp_server, smtp_port)
    server.starttls()
    server.login(sender_email, sender_password)
    server.sendmail(sender_email, recipient_email, msg.as_string())
    server.quit()
    print("Test email sent successfully.")
except Exception as e:
    print("Failed to send test email:", e)
