import { useEffect, useId, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowUp,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Search,
  Users,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Button } from "./ui/button"
import { Card, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog"
import { cn } from "./ui/utils"
import { usePortal } from "./PortalBackend"
import { supabase } from "../lib/supabase"
import { errorMessage } from "../lib/portal-data"
import {
  attachmentUrl,
  loadMessages,
  saveMessage,
  type ChatAttachment,
  type ChatMessage,
} from "./chat-storage"

interface PortalMember {
  id: string
  name: string
  role: string
  initials: string
  tone: string
}
interface Draft {
  text: string
  attachments: ChatAttachment[]
}
const emptyDraft: Draft = { text: "", attachments: [] }
const maxFileSize = 10 * 1024 * 1024
const maxAttachments = 5
const time = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
const isPreviewable = (type: string) =>
  ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"].includes(
    type,
  )

interface MemberAvatarProps {
  member: PortalMember
  large?: boolean
}

function MemberAvatar(props: MemberAvatarProps) {
  const { member } = props
  const isLarge = props.large === true
  return (
    <Avatar className={cn("rounded-xl", isLarge && "size-14 rounded-2xl")}>
      <AvatarFallback
        className={cn(
          "rounded-xl text-sm font-semibold",
          isLarge && "rounded-2xl",
          member.tone,
        )}
      >
        {member.initials}
      </AvatarFallback>
    </Avatar>
  )
}

function Attachment({
  attachment,
  compact = false,
}: {
  attachment: ChatAttachment
  compact?: boolean
}) {
  const [url, setUrl] = useState("")
  const [fileError, setFileError] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  useEffect(() => {
    let cancelled = false
    let objectUrl = ""
    setUrl("")
    setFileError("")
    const resolve = attachment.blob
      ? Promise.resolve(URL.createObjectURL(attachment.blob))
      : attachmentUrl(attachment)
    resolve
      .then((value) => {
        objectUrl = value
        if (cancelled) URL.revokeObjectURL(value)
        else setUrl(value)
      })
      .catch((cause) => {
        if (!cancelled) setFileError(errorMessage(cause))
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.blob, attachment.path])

  function download() {
    if (!url) return
    const link = document.createElement("a")
    link.href = url
    link.download = attachment.name
    link.click()
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-foreground/10 bg-background/15",
        compact && "max-w-48",
      )}
    >
      {isPreviewable(attachment.type) && !compact && (
        <Button
          variant="ghost"
          className="h-auto w-full rounded-none p-0 hover:bg-transparent"
          onClick={() => setPreviewOpen(true)}
          disabled={!url}
          aria-label={`View ${attachment.name}`}
        >
          <img
            src={url || undefined}
            alt={attachment.name}
            className="max-h-52 w-full object-cover"
          />
        </Button>
      )}
      <div className="flex min-w-0 items-center gap-2 p-2.5">
        <FileText className="size-4 shrink-0 opacity-70" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{attachment.name}</div>
          <div className="text-xs opacity-60">{size(attachment.size)}</div>
        </div>
        {!compact && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-inherit hover:bg-foreground/10 hover:text-inherit"
            disabled={!url}
            onClick={download}
            aria-label={`Download ${attachment.name}`}
          >
            <Download className="size-3.5" />
          </Button>
        )}
      </div>
      {fileError && (
        <div role="alert" className="px-3 pb-2 text-xs text-destructive">
          Attachment unavailable: {fileError}
        </div>
      )}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="border-border bg-popover sm:max-w-3xl">
          <DialogTitle className="break-all pr-6">
            {attachment.name}
          </DialogTitle>
          <DialogDescription>
            {size(attachment.size)} · Image attachment
          </DialogDescription>
          <img
            src={url || undefined}
            alt={attachment.name}
            className="max-h-96 w-full rounded-lg object-contain"
          />
          <Button variant="secondary" onClick={download}>
            <Download className="size-4" />
            Download image
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ChatSection() {
  const { members: portalMembers, userId } = usePortal()
  const members: PortalMember[] = portalMembers
    .filter((member) => member.authId && member.authId !== userId)
    .map((member) => ({
      id: member.authId!,
      name: member.name,
      role: member.role,
      initials: member.avatar,
      tone: "bg-primary/15 text-primary",
    }))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [connectionError, setConnectionError] = useState("")
  const [announcement, setAnnouncement] = useState("")
  const fileInputId = useId()
  const imageInputId = useId()
  const timeline = useRef<HTMLDivElement>(null)
  const sendLock = useRef(false)
  const selected = members.find((member) => member.id === selectedId)
  const draft = selectedId ? (drafts[selectedId] ?? emptyDraft) : emptyDraft
  const conversation = messages.filter(
    (message) => message.memberId === selectedId,
  )
  const filtered = members.filter((member) =>
    `${member.name} ${member.role}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  )

  useEffect(() => {
    let cancelled = false
    let fetching = false
    async function refreshMessages() {
      if (fetching || sendLock.current) return
      fetching = true
      try {
        const stored = await loadMessages(userId)
        if (!cancelled) {
          setMessages((current) => {
            const combined = new Map(
              [...current, ...stored].map((message) => [message.id, message]),
            )
            return [...combined.values()].sort((a, b) =>
              a.sentAt.localeCompare(b.sentAt),
            )
          })
          setLoadFailed(false)
          setConnectionError("")
        }
      } catch (cause) {
        if (!cancelled) {
          setLoadFailed(true)
          setConnectionError(errorMessage(cause))
        }
      } finally {
        fetching = false
        if (!cancelled) setLoading(false)
      }
    }
    void refreshMessages()
    const channel = supabase
      .channel(`portal-messages-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => void refreshMessages(),
      )
      .subscribe()
    const poll = window.setInterval(() => void refreshMessages(), 10000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [userId])

  useEffect(() => {
    if (timeline.current)
      timeline.current.scrollTop = timeline.current.scrollHeight
  }, [selectedId, messages, loading])

  function updateDraft(update: Partial<Draft>) {
    if (!selectedId) return
    setDrafts((current) => ({
      ...current,
      [selectedId]: { ...(current[selectedId] ?? emptyDraft), ...update },
    }))
  }

  function attachFiles(files: FileList | null) {
    if (!files || !selectedId || sending) return
    const incoming = Array.from(files)
    if (incoming.length + draft.attachments.length > maxAttachments) {
      setError(
        "You can attach up to 5 files per message. Remove an attachment and try again.",
      )
      return
    }
    if (incoming.some((file) => file.size > maxFileSize)) {
      setError(
        "Each attachment must be 10 MB or smaller. Please choose a smaller file.",
      )
      return
    }
    updateDraft({
      attachments: [
        ...draft.attachments,
        ...incoming.map((file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          blob: file,
        })),
      ],
    })
    setError("")
  }

  async function send() {
    if (
      !selectedId ||
      sendLock.current ||
      loading ||
      loadFailed ||
      (!draft.text.trim() && !draft.attachments.length)
    )
      return
    sendLock.current = true
    setSending(true)
    setError("")
    const memberId = selectedId
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      memberId,
      outgoing: true,
      text: draft.text.trim(),
      sentAt: new Date().toISOString(),
      attachments: draft.attachments,
    }
    try {
      const saved = await saveMessage(message, userId)
      setMessages((current) =>
        [...current.filter((item) => item.id !== saved.id), saved].sort(
          (a, b) => a.sentAt.localeCompare(b.sentAt),
        ),
      )
      setDrafts((current) => ({ ...current, [memberId]: emptyDraft }))
      setAnnouncement("Message sent.")
    } catch (cause) {
      setError(`${errorMessage(cause)} Your draft is still here — try again.`)
    } finally {
      sendLock.current = false
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
            Member Chat
          </CardTitle>
          <div className="mt-1 text-sm text-muted-foreground">
            A space to connect, share ideas, and keep things moving.
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex">
          <Users className="size-3.5" />
          {members.length} members
        </div>
      </div>

      <Card className="gap-0 overflow-hidden rounded-2xl border-border bg-card py-0 shadow-none backdrop-blur-xl">
        <div className="flex h-144 md:h-160">
          <div
            className={cn(
              "flex w-full shrink-0 flex-col border-border md:w-64 md:border-r lg:w-72",
              selected && "hidden md:flex",
            )}
          >
            <div className="space-y-3 border-b border-border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Members</span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {members.length}
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 size-3.5 text-muted-foreground" />
                <Input
                  className="h-9 rounded-xl border-border bg-secondary pl-9 text-xs placeholder:text-muted-foreground"
                  placeholder="Search members…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search members"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {filtered.map((member) => {
                const last = messages
                  .filter((message) => message.memberId === member.id)
                  .at(-1)
                return (
                  <Button
                    key={member.id}
                    variant="ghost"
                    onClick={() => {
                      setSelectedId(member.id)
                      setError(
                        loadFailed
                          ? "Chat storage is unavailable. Enable browser storage and reload."
                          : "",
                      )
                      setAnnouncement("")
                    }}
                    aria-pressed={selectedId === member.id}
                    className={cn(
                      "h-auto w-full justify-start gap-3 rounded-xl p-3 text-left hover:bg-secondary hover:text-foreground",
                      selectedId === member.id &&
                        "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <MemberAvatar member={member} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {member.name}
                        </span>
                        {last && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {time(last.sentAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs font-normal text-muted-foreground">
                        {last
                          ? `${
                              last.outgoing ? "You: " : ""
                            }${last.text || last.attachments[0]?.name || "Attachment"}`
                          : member.role}
                      </div>
                    </div>
                  </Button>
                )
              })}
              {!filtered.length && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {members.length
                    ? "No members found."
                    : "No other members are available yet."}
                  <div className="mt-1 text-xs">
                    {members.length
                      ? "Try another name or role."
                      : "Ask an administrator to link other Members rows to their Supabase Auth accounts."}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              Member directory · Supabase
            </div>
          </div>

          <div
            className={cn(
              "min-w-0 flex-1 flex-col",
              selected ? "flex" : "hidden md:flex",
            )}
          >
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-accent/10">
                  <MessagesSquare className="size-7 text-primary" />
                </div>
                <div className="text-lg font-semibold tracking-tight">
                  Good conversations start here.
                </div>
                <div className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  Choose a member to start a conversation. Share a thought, a
                  file, or your next big idea.
                </div>
                <div className="mt-7 flex items-center gap-2 text-xs text-muted-foreground">
                  <Paperclip className="size-3.5" />
                  Text, images, and files — all in one place
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back to members"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <MemberAvatar member={selected} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {selected.name}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {selected.role}
                    </div>
                  </div>
                  <span className="ml-auto hidden rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground sm:block">
                    Direct message
                  </span>
                </div>

                <div
                  ref={timeline}
                  onLoadCapture={() => {
                    if (timeline.current)
                      timeline.current.scrollTop = timeline.current.scrollHeight
                  }}
                  role="region"
                  aria-label={`Conversation with ${selected.name}`}
                  aria-busy={loading}
                  className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"
                >
                  {loading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading conversation…
                    </div>
                  ) : !conversation.length ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MemberAvatar member={selected} large />
                      <div className="mt-4 text-sm font-medium">
                        Start a conversation with {selected.name.split(" ")[0]}
                      </div>
                      <div className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                        Say hello or share something you’re working on.
                        <br />
                        This is the beginning of your conversation.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {conversation.map((message, index) => {
                        const date = new Date(
                          message.sentAt,
                        ).toLocaleDateString([], {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                        const showDate =
                          !index ||
                          new Date(
                            conversation[index - 1].sentAt,
                          ).toDateString() !==
                            new Date(message.sentAt).toDateString()
                        return (
                          <div key={message.id}>
                            {showDate && (
                              <div className="mb-5 text-center text-xs text-muted-foreground">
                                {date}
                              </div>
                            )}
                            <div
                              className={cn(
                                "flex",
                                message.outgoing
                                  ? "justify-end"
                                  : "justify-start",
                              )}
                            >
                              <div className="max-w-4/5 space-y-1.5">
                                <div
                                  className={cn(
                                    "space-y-2 rounded-2xl px-4 py-3 shadow-sm",
                                    message.outgoing
                                      ? "rounded-br-md bg-primary text-primary-foreground"
                                      : "rounded-bl-md bg-secondary text-foreground",
                                  )}
                                >
                                  {message.text && (
                                    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                      {message.text}
                                    </div>
                                  )}
                                  {message.attachments.map((attachment) => (
                                    <Attachment
                                      key={attachment.id}
                                      attachment={attachment}
                                    />
                                  ))}
                                </div>
                                <div className="flex justify-end gap-1.5 text-xs text-muted-foreground">
                                  <span>{time(message.sentAt)}</span>
                                  <span>
                                    ·{" "}
                                    {message.outgoing
                                      ? "Sent"
                                      : selected.name.split(" ")[0]}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-border p-4 sm:px-5">
                  {error && (
                    <div
                      role="alert"
                      className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                    >
                      {error}
                    </div>
                  )}
                  {!!draft.attachments.length && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {draft.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="relative shrink-0 pr-2 pt-2"
                        >
                          <Attachment attachment={attachment} compact />
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute right-0 top-0 size-5 rounded-full"
                            disabled={sending}
                            aria-label={`Remove ${attachment.name}`}
                            onClick={() =>
                              updateDraft({
                                attachments: draft.attachments.filter(
                                  (item) => item.id !== attachment.id,
                                ),
                              })
                            }
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-xl border border-border bg-input-background focus-within:border-primary/50">
                    <Textarea
                      aria-label={`Message ${selected.name}`}
                      placeholder={`Message ${selected.name.split(" ")[0]}…`}
                      className="min-h-12 max-h-28 rounded-xl border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
                      rows={1}
                      value={draft.text}
                      disabled={loading || loadFailed || sending}
                      onChange={(event) =>
                        updateDraft({ text: event.target.value })
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault()
                          void send()
                        }
                      }}
                    />
                    <div className="flex items-center gap-1 px-2 pb-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        disabled={loading || loadFailed || sending}
                        onClick={() =>
                          document.getElementById(fileInputId)?.click()
                        }
                        aria-label="Attach files"
                      >
                        <Paperclip className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        disabled={loading || loadFailed || sending}
                        onClick={() =>
                          document.getElementById(imageInputId)?.click()
                        }
                        aria-label="Attach images"
                      >
                        <ImagePlus className="size-4" />
                      </Button>
                      <span className="ml-1 hidden text-xs text-muted-foreground lg:block">
                        Enter to send · Shift + Enter for a new line
                      </span>
                      <Button
                        size="icon"
                        className="ml-auto size-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/85"
                        disabled={
                          loading ||
                          loadFailed ||
                          sending ||
                          (!draft.text.trim() && !draft.attachments.length)
                        }
                        onClick={() => void send()}
                        aria-label="Send message"
                      >
                        {sending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ArrowUp className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="text-center text-xs text-muted-foreground">
                    Up to 5 attachments · 10 MB per file
                  </div>
                  <Input
                    id={fileInputId}
                    type="file"
                    multiple
                    className="hidden"
                    tabIndex={-1}
                    aria-label="Choose files"
                    onChange={(event) => {
                      attachFiles(event.target.files)
                      event.target.value = ""
                    }}
                  />
                  <Input
                    id={imageInputId}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    tabIndex={-1}
                    aria-label="Choose images"
                    onChange={(event) => {
                      attachFiles(event.target.files)
                      event.target.value = ""
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
      {connectionError && (
        <div role="alert" className="text-xs text-destructive">
          {connectionError} Chat will retry automatically.
        </div>
      )}
      {error && !selected && (
        <div role="alert" className="text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <MessageCircle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Messages are delivered through Supabase. Attachments are stored in a
          private bucket for the two conversation participants.
        </span>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
