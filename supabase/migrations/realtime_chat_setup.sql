-- Enable real-time functionality for chat_messages table
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- Enable real-time on the table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Create a function to notify on message inserts
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Perform the notification using pg_notify
  PERFORM pg_notify(
    'new_message_' || NEW.recipient_id,
    json_build_object(
      'id', NEW.id,
      'sender_id', NEW.sender_id,
      'recipient_id', NEW.recipient_id,
      'text', NEW.text,
      'audio_url', NEW.audio_url,
      'timestamp', NEW.timestamp,
      'is_read', NEW.is_read,
      'is_urgent', NEW.is_urgent
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new message notifications
DROP TRIGGER IF EXISTS trigger_notify_new_message ON chat_messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Create a function to handle message read status updates
CREATE OR REPLACE FUNCTION notify_message_read()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if is_read changed from false to true
  IF OLD.is_read = false AND NEW.is_read = true THEN
    PERFORM pg_notify(
      'message_read_' || NEW.sender_id,
      json_build_object(
        'message_id', NEW.id,
        'conversation_id', NEW.sender_id || '_' || NEW.recipient_id
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message read notifications
DROP TRIGGER IF EXISTS trigger_notify_message_read ON chat_messages;
CREATE TRIGGER trigger_notify_message_read
  AFTER UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_message_read();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON chat_messages TO anon, authenticated;
GRANT EXECUTE ON FUNCTION notify_new_message() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION notify_message_read() TO anon, authenticated;