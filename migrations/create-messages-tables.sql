-- Conversations table to track LinkedIn conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  participant_name VARCHAR(255) NOT NULL,
  participant_profile_url VARCHAR(500),
  participant_headline VARCHAR(500),
  participant_avatar_url TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  thread_id VARCHAR(255) NOT NULL, -- LinkedIn conversation thread ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(linkedin_account_id, thread_id)
);

-- Messages table to store individual messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL, -- LinkedIn message ID
  sender_name VARCHAR(255) NOT NULL,
  sender_profile_url VARCHAR(500),
  is_from_me BOOLEAN DEFAULT FALSE,
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  has_attachment BOOLEAN DEFAULT FALSE,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(linkedin_account_id, message_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_linkedin_account ON conversations(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(linkedin_account_id, unread_count) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(linkedin_account_id, is_archived);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_linkedin_account ON messages(linkedin_account_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;

-- Function to update conversation's last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.sent_at,
    last_message_preview = LEFT(NEW.content, 200),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update conversation when new message arrives
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON messages;
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Function to update unread count
CREATE OR REPLACE FUNCTION update_conversation_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = FALSE AND NEW.is_from_me = FALSE THEN
    UPDATE conversations
    SET unread_count = unread_count + 1
    WHERE id = NEW.conversation_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_read = FALSE AND NEW.is_read = TRUE THEN
    UPDATE conversations
    SET unread_count = GREATEST(0, unread_count - 1)
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain unread count
DROP TRIGGER IF EXISTS trigger_update_unread_count ON messages;
CREATE TRIGGER trigger_update_unread_count
  AFTER INSERT OR UPDATE OF is_read ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_unread_count();
