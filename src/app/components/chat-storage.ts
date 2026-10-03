import { supabase } from "../lib/supabase"

export interface ChatAttachment {
  id: string
  name: string
  type: string
  size: number
  blob?: Blob
  path?: string
}
export interface ChatMessage {
  id: string
  memberId: string
  outgoing: boolean
  text: string
  sentAt: string
  attachments: ChatAttachment[]
}
interface MessageRow {
  id: string | number
  sender_id: string
  recipient_id: string
  text: string | null
  sent_at: string
  attachments: unknown
}
const columns = "id,sender_id,recipient_id,text,sent_at,attachments"
const bucket = "portal-chat"
function mapMessage(row: MessageRow, userId: string): ChatMessage {
  const outgoing = row.sender_id === userId
  const attachments = Array.isArray(row.attachments)
    ? row.attachments.filter(
        (item): item is ChatAttachment =>
          item !== null &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.type === "string" &&
          typeof item.size === "number" &&
          typeof item.path === "string" &&
          item.path.startsWith(`${row.sender_id}/${row.recipient_id}/`),
      )
    : []
  return {
    id: String(row.id),
    memberId: outgoing ? row.recipient_id : row.sender_id,
    outgoing,
    text: row.text ?? "",
    sentAt: row.sent_at,
    attachments,
  }
}
export async function attachmentUrl(
  attachment: ChatAttachment,
): Promise<string> {
  if (!attachment.path) throw new Error("This attachment is not available.")
  // Download on demand: private files never receive public URLs, and existing
  // object-URL cleanup in the view keeps large conversations memory-safe.
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(attachment.path)
  if (error) throw error
  return URL.createObjectURL(data)
}
export async function loadMessages(userId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("Messages")
    .select(columns)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("sent_at", { ascending: true })
  if (error) throw error
  return (data as MessageRow[]).map((row) => mapMessage(row, userId))
}
export async function saveMessage(
  message: ChatMessage,
  userId: string,
): Promise<ChatMessage> {
  const uploaded: string[] = []
  const attachments: ChatAttachment[] = []
  try {
    for (const item of message.attachments) {
      if (!item.blob || item.size > 10 * 1024 * 1024)
        throw new Error("An attachment is missing or exceeds the 10 MB limit.")
      const name = item.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment"
      const path = `${userId}/${message.memberId}/${crypto.randomUUID()}/${name}`
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, item.blob, {
          contentType: item.type || "application/octet-stream",
          upsert: false,
        })
      if (error) throw error
      uploaded.push(path)
      attachments.push({
        id: item.id,
        name: item.name,
        type: item.type,
        size: item.size,
        path,
      })
    }
    const { data, error } = await supabase
      .from("Messages")
      .insert({
        sender_id: userId,
        recipient_id: message.memberId,
        text: message.text,
        sent_at: message.sentAt,
        attachments,
      })
      .select(columns)
      .single()
    if (error) throw error
    return mapMessage(data as MessageRow, userId)
  } catch (error) {
    // Remove uploads when the message was rejected; keep the browser draft.
    if (uploaded.length) await supabase.storage.from(bucket).remove(uploaded)
    throw error
  }
}
