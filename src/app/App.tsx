import { useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  Activity,
  Bell,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FolderKanban,
  Globe,
  Layers,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  MessagesSquare,
  Phone,
  RefreshCw,
  Search,
  Shield,
  Star,
  Upload,
  User,
  X,
  Edit3,
} from "lucide-react"
import { ChatSection } from "./components/ChatSection"
import {
  PortalBackend,
  PortalStatus,
  usePortal,
} from "./components/PortalBackend"
import { ProfileEditor } from "./components/ProfileEditor"
import { ProjectCreateDialog } from "./components/ProjectCreateDialog"
import { Avatar, AvatarFallback } from "./components/ui/avatar"
import { Badge } from "./components/ui/badge"
import { Button } from "./components/ui/button"
import { Card, CardTitle } from "./components/ui/card"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Textarea } from "./components/ui/textarea"
import { cn } from "./components/ui/utils"
import { supabase } from "./lib/supabase"
import { errorMessage, type Project, type Query } from "./lib/portal-data"

type Section = "profile" | "queries" | "projects" | "chat"
function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
}
function safeUrl(value: string) {
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) ? url.href : ""
  } catch {
    return ""
  }
}
function GlassCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-2xl border-border bg-card shadow-none backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </Card>
  )
}
function AmbientBackdrop() {
  const reduceMotion = useReducedMotion()
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      <motion.div
        className="absolute -left-40 -top-40 size-160 rounded-full bg-primary/10 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, 80, 20, 0],
                y: [0, 30, 90, 0],
                scale: [1, 1.08, 0.96, 1],
              }
        }
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 size-144 rounded-full bg-accent/10 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, -70, -20, 0],
                y: [0, -40, -90, 0],
                scale: [1, 0.95, 1.1, 1],
              }
        }
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
      <motion.div
        className="absolute left-1/2 top-1/3 size-72 -translate-x-1/2 rounded-full bg-chart-4/5 blur-3xl"
        animate={reduceMotion ? undefined : { opacity: [0.25, 0.55, 0.25] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-border)_1px,transparent_1px)] bg-[length:32px_32px] opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
    </div>
  )
}
const queryTones = {
  pending: "bg-chart-5/10 text-chart-5",
  answered: "bg-primary/10 text-primary",
  cleared: "bg-chart-3/10 text-chart-3",
}
const projectTones = {
  published: "bg-chart-3/10 text-chart-3",
  draft: "bg-chart-5/10 text-chart-5",
  archived: "bg-secondary text-muted-foreground",
}
function QueryStatusPill({ status }: { status: Query["status"] }) {
  return (
    <Badge
      className={cn(
        "gap-1.5 rounded-full border-0 px-2.5 py-1 capitalize",
        queryTones[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  )
}
function ProjectStatusPill({ status }: { status: Project["status"] }) {
  return (
    <Badge
      className={cn(
        "rounded-full border-0 px-2.5 py-1 capitalize",
        projectTones[status],
      )}
    >
      {status}
    </Badge>
  )
}
function ProfileSection() {
  const { member, projects, queries } = usePortal()
  const stats = [
    {
      label: "Live Projects",
      value: projects.filter((p) => p.status === "published").length,
      tone: "text-primary",
    },
    {
      label: "Queries Resolved",
      value: queries.filter((q) => q.status !== "pending").length,
      tone: "text-chart-3",
    },
    {
      label: "Featured Works",
      value: projects.filter((p) => p.featured).length,
      tone: "text-accent",
    },
  ]
  const now = new Date()
  const activity = Array.from(
    { length: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() },
    (_, day) =>
      queries.filter((q) => {
        const date = new Date(q.date)
        return (
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === day + 1
        )
      }).length,
  )
  const peak = Math.max(1, ...activity)
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <ProfileEditor />
      </div>
      <GlassCard className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="relative">
            <Avatar className="size-20 rounded-2xl">
              <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary to-accent text-2xl font-semibold text-primary-foreground">
                {member.avatar}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-background bg-chart-3">
              <span className="size-1.5 rounded-full bg-primary-foreground" />
            </span>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {member.name}
              </CardTitle>
              <Badge className="rounded-full border-0 bg-primary/15 text-primary">
                <Shield />
                {member.role}
              </Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {member.role}
            </div>
            <div className="mt-3 max-w-xl text-sm leading-relaxed text-foreground/70">
              {member.bio || "Add a bio to introduce yourself to the team."}
            </div>
          </div>
          <div
            className="flex gap-3 sm:flex-col sm:items-end"
            title="Team-wide totals from Supabase"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-right">
                <div className={cn("text-2xl font-bold", stat.tone)}>
                  {stat.value}
                </div>
                <div className="text-xs leading-tight text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <GlassCard>
          <div className="border-b border-border px-5 py-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Contact Information
          </div>
          <div className="divide-y divide-border">
            {[
              { icon: Mail, label: "Email", value: member.email },
              { icon: Phone, label: "Phone", value: member.phone },
              { icon: MapPin, label: "Location", value: member.location },
              { icon: Calendar, label: "Member Since", value: member.joinDate },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="size-3.5" />
                </div>
                <span className="w-24 shrink-0 text-xs text-muted-foreground">
                  {label}
                </span>
                <span className="min-w-0 break-words text-sm text-foreground/90">
                  {value || "Not provided"}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="border-b border-border px-5 py-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Specialisations
          </div>
          <div className="flex flex-wrap gap-2 p-5">
            {member.specialisations.length ? (
              member.specialisations.map((item, index) => (
                <Badge
                  key={`${item}-${index}`}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-sm",
                    [
                      "border-primary/20 bg-primary/10 text-primary",
                      "border-accent/20 bg-accent/10 text-accent",
                      "border-chart-3/20 bg-chart-3/10 text-chart-3",
                      "border-chart-4/20 bg-chart-4/10 text-chart-4",
                    ][index % 4],
                  )}
                >
                  {item}
                </Badge>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                Add your specialisations in Edit profile.
              </div>
            )}
          </div>
          <div className="mt-auto border-t border-border px-5 py-4">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="size-3.5 text-chart-3" />
              Queries received this month
            </div>
            <div
              className="flex h-10 items-end gap-1"
              role="img"
              aria-label={`${activity.reduce((a, b) => a + b, 0)} visitor queries received this month`}
            >
              {activity.map((count, day) => (
                <div
                  key={day}
                  className="flex-1 rounded-sm bg-primary/60"
                  style={{ height: `${(count / peak) * 100}%` }}
                  title={`${day + 1}: ${count} queries`}
                />
              ))}
            </div>
            {!activity.some(Boolean) && (
              <div className="mt-1 text-xs text-muted-foreground">
                No queries received this month.
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
function QueriesSection() {
  const { queries, setQueryStatus, saving, refreshing } = usePortal()
  const [filter, setFilter] = useState<"all" | Query["status"]>("all")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const counts = {
    all: queries.length,
    pending: queries.filter((q) => q.status === "pending").length,
    answered: queries.filter((q) => q.status === "answered").length,
    cleared: queries.filter((q) => q.status === "cleared").length,
  }
  const filtered = queries.filter(
    (q) =>
      (filter === "all" || q.status === filter) &&
      `${q.name} ${q.subject}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  )
  return (
    <div className="space-y-5">
      <GlassCard className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-chart-5/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Visitor Queries
            </CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              Messages received from the live website contact form
            </div>
          </div>
          {counts.pending > 0 && (
            <Badge className="rounded-xl border-0 bg-chart-5/10 px-3.5 py-2 text-chart-5 sm:ml-auto">
              <MessageSquare />
              {counts.pending} awaiting response
            </Badge>
          )}
        </div>
      </GlassCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 self-start rounded-xl border border-border bg-card p-1">
          {(["all", "pending", "answered", "cleared"] as const).map(
            (status) => (
              <Button
                key={status}
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-lg px-3 text-xs capitalize",
                  filter === status
                    ? "bg-primary/20 text-primary hover:bg-primary/20 hover:text-primary"
                    : "text-muted-foreground hover:bg-secondary",
                )}
                onClick={() => setFilter(status)}
              >
                {status}
                <span className="text-xs opacity-60">{counts[status]}</span>
              </Button>
            ),
          )}
        </div>
        <div className="relative sm:ml-auto">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search queries…"
            aria-label="Search visitor queries"
            className="rounded-xl border-border bg-card pl-9 sm:w-64"
          />
        </div>
      </div>
      {!filtered.length && (
        <GlassCard className="p-10 text-center text-sm text-muted-foreground">
          {queries.length
            ? "No queries match your search."
            : "No visitor queries have been received yet."}
        </GlassCard>
      )}
      <div className="space-y-3">
        {filtered.map((q) => (
          <GlassCard key={q.id} className="overflow-hidden">
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-4 rounded-none px-5 py-4 text-left hover:bg-secondary"
              aria-expanded={expanded === q.id}
              onClick={() => setExpanded(expanded === q.id ? null : q.id)}
            >
              <Avatar className="size-9 shrink-0 rounded-xl">
                <AvatarFallback
                  className={cn("rounded-xl", queryTones[q.status])}
                >
                  {q.name
                    .trim()
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{q.name}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {q.email}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-sm font-normal text-foreground/60">
                  {q.subject}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden text-xs text-muted-foreground lg:inline">
                  {formatDate(q.date)}
                </span>
                <QueryStatusPill status={q.status} />
                {expanded === q.id ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </div>
            </Button>
            {expanded === q.id && (
              <div className="border-t border-border px-5 pb-5 pt-1">
                <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/70">
                  {q.message}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {q.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-xl bg-primary/20 text-primary hover:bg-primary/30"
                        disabled={saving || refreshing}
                        onClick={() => void setQueryStatus(q.id, "answered")}
                      >
                        <Check className="size-3.5" />
                        Mark Answered
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-xl bg-destructive/15 text-destructive hover:bg-destructive/20"
                        disabled={saving || refreshing}
                        onClick={() => void setQueryStatus(q.id, "cleared")}
                      >
                        <X className="size-3.5" />
                        Clear
                      </Button>
                    </>
                  )}
                  {q.status === "answered" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-xl bg-chart-3/15 text-chart-3 hover:bg-chart-3/20"
                      disabled={saving || refreshing}
                      onClick={() => void setQueryStatus(q.id, "cleared")}
                    >
                      <CheckCircle className="size-3.5" />
                      Mark Cleared
                    </Button>
                  )}
                  {q.status === "cleared" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-xl text-muted-foreground"
                      disabled={saving || refreshing}
                      onClick={() => void setQueryStatus(q.id, "pending")}
                    >
                      <RefreshCw className="size-3.5" />
                      Reopen
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto rounded-xl text-muted-foreground"
                    disabled={!q.email}
                    onClick={() => {
                      window.location.href = `mailto:${encodeURIComponent(q.email)}?subject=${encodeURIComponent(`Re: ${q.subject}`)}`
                    }}
                  >
                    <Mail className="size-3.5" />
                    Reply via Email
                  </Button>
                </div>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
function ProjectsSection() {
  const { projects, saveProject, saving, refreshing } = usePortal()
  const [editing, setEditing] = useState<string | null>(null)
  const [buffer, setBuffer] = useState<Partial<Project>>({})
  const [filter, setFilter] = useState<"all" | Project["status"]>("all")
  const filtered = projects.filter(
    (p) => filter === "all" || p.status === filter,
  )
  async function save(id: string) {
    if (
      buffer.title?.trim() &&
      (await saveProject(id, { ...buffer, title: buffer.title.trim() }))
    )
      setEditing(null)
  }
  const nextStatus: Record<Project["status"], Project["status"]> = {
    published: "draft",
    draft: "archived",
    archived: "published",
  }
  return (
    <div className="space-y-5">
      <GlassCard className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Website Projects
            </CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              Manage and publish projects displayed on the live website
            </div>
          </div>
          <div className="sm:ml-auto">
            <ProjectCreateDialog />
          </div>
          <div className="flex gap-1 self-start rounded-xl border border-border bg-secondary p-1">
            {(["all", "published", "draft", "archived"] as const).map(
              (status) => (
                <Button
                  key={status}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "rounded-lg px-3 text-xs capitalize",
                    filter === status
                      ? "bg-accent/20 text-accent hover:bg-accent/20 hover:text-accent"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                  onClick={() => setFilter(status)}
                >
                  {status}
                </Button>
              ),
            )}
          </div>
        </div>
      </GlassCard>
      {!filtered.length && (
        <GlassCard className="p-8 text-center text-sm text-muted-foreground">
          {projects.length
            ? "No projects match this filter."
            : "No projects have been added to Supabase yet."}
        </GlassCard>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => (
          <GlassCard key={p.id} className="group overflow-hidden">
            <div className="relative h-44 overflow-hidden bg-secondary">
              {safeUrl(p.image) ? (
                <img
                  src={safeUrl(p.image)}
                  alt={p.title}
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <FolderKanban className="size-10" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
              <div className="absolute left-3 top-3 flex gap-2">
                <ProjectStatusPill status={p.status} />
                {p.featured && (
                  <Badge className="rounded-full border-0 bg-chart-5/20 text-chart-5">
                    <Star className="fill-current" />
                    Featured
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              {editing === p.id ? (
                <form
                  className="flex-1 space-y-2.5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void save(p.id)
                  }}
                >
                  <div className="space-y-1">
                    <Label htmlFor={`title-${p.id}`} className="sr-only">
                      Project title
                    </Label>
                    <Input
                      id={`title-${p.id}`}
                      required
                      disabled={saving}
                      value={buffer.title || ""}
                      onChange={(event) =>
                        setBuffer({ ...buffer, title: event.target.value })
                      }
                      className="rounded-xl border-border bg-secondary"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`category-${p.id}`} className="sr-only">
                      Category
                    </Label>
                    <Input
                      id={`category-${p.id}`}
                      disabled={saving}
                      value={buffer.category || ""}
                      onChange={(event) =>
                        setBuffer({ ...buffer, category: event.target.value })
                      }
                      placeholder="Category"
                      className="rounded-xl border-border bg-secondary text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`description-${p.id}`} className="sr-only">
                      Description
                    </Label>
                    <Textarea
                      id={`description-${p.id}`}
                      disabled={saving}
                      rows={3}
                      value={buffer.description || ""}
                      onChange={(event) =>
                        setBuffer({
                          ...buffer,
                          description: event.target.value,
                        })
                      }
                      className="resize-none rounded-xl border-border bg-secondary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      className="flex-1 rounded-xl bg-primary/20 text-primary hover:bg-primary/30"
                      disabled={saving || refreshing || !buffer.title?.trim()}
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="flex-1 rounded-xl text-muted-foreground"
                      disabled={saving}
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {p.category}
                    </div>
                    <CardTitle className="text-base font-semibold leading-tight">
                      {p.title}
                    </CardTitle>
                  </div>
                  <div className="flex-1 text-xs leading-relaxed text-foreground/55">
                    {p.description}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((tag, i) => (
                      <Badge
                        key={`${tag}-${i}`}
                        variant="secondary"
                        className="rounded-full text-xs text-muted-foreground"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Updated {formatDate(p.lastUpdated)}
                  </div>
                </>
              )}
            </div>
            {editing !== p.id && (
              <div className="flex divide-x divide-border border-t border-border">
                <Button
                  variant="ghost"
                  className="flex-1 rounded-none text-primary hover:bg-secondary"
                  title="Edit"
                  aria-label={`Edit ${p.title}`}
                  disabled={saving || refreshing}
                  onClick={() => {
                    setEditing(p.id)
                    setBuffer({
                      title: p.title,
                      description: p.description,
                      category: p.category,
                    })
                  }}
                >
                  <Edit3 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  className={cn(
                    "flex-1 rounded-none text-chart-5 hover:bg-secondary",
                    p.featured && "bg-chart-5/10",
                  )}
                  title={p.featured ? "Unfeature" : "Feature"}
                  aria-label={`${
                    p.featured ? "Unfeature" : "Feature"
                  } ${p.title}`}
                  disabled={saving || refreshing}
                  onClick={() =>
                    void saveProject(p.id, { featured: !p.featured })
                  }
                >
                  <Star
                    className={cn("size-3.5", p.featured && "fill-current")}
                  />
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 rounded-none text-chart-3 hover:bg-secondary"
                  title={`Change to ${nextStatus[p.status]}`}
                  aria-label={`Change ${p.title} to ${nextStatus[p.status]}`}
                  disabled={saving || refreshing}
                  onClick={() =>
                    void saveProject(p.id, { status: nextStatus[p.status] })
                  }
                >
                  <Upload className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 rounded-none text-chart-4 hover:bg-secondary"
                  title="View Live"
                  aria-label={`View ${p.title} live`}
                  disabled={!safeUrl(p.liveUrl)}
                  onClick={() =>
                    window.open(
                      safeUrl(p.liveUrl),
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <ExternalLink className="size-3.5" />
                </Button>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
export default function App() {
  return (
    <PortalBackend>
      <MemberPortal />
    </PortalBackend>
  )
}
function MemberPortal() {
  const { member, queries, saving } = usePortal()
  const [section, setSection] = useState<Section>("profile")
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState("")
  const pending = queries.filter((q) => q.status === "pending").length
  const nav = [
    { id: "profile" as const, label: "Profile", icon: User, count: 0 },
    {
      id: "queries" as const,
      label: "Queries",
      icon: MessageSquare,
      count: pending,
    },
    {
      id: "projects" as const,
      label: "Projects",
      icon: FolderKanban,
      count: 0,
    },
    { id: "chat" as const, label: "Chat", icon: MessagesSquare, count: 0 },
  ]
  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError("")
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (cause) {
      setSignOutError(errorMessage(cause))
    } finally {
      setSigningOut(false)
    }
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AmbientBackdrop />
      <header className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-5 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <Globe className="size-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Bitgenix Member Portal
            </span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Members only
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="relative size-8 rounded-full text-muted-foreground hover:bg-secondary"
              onClick={() => setSection("queries")}
              aria-label={`Visitor queries, ${pending} pending`}
            >
              <Bell className="size-4" />
              {pending > 0 && (
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" />
              )}
            </Button>
            <div className="flex items-center gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-xs font-semibold text-primary-foreground">
                  {member.avatar}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-foreground/80 sm:block">
                {member.name.split(" ")[0]}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground hover:bg-secondary"
              onClick={() => void signOut()}
              disabled={saving || signingOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <div className="relative mx-auto flex min-h-screen max-w-screen-2xl">
        <aside className="sticky top-14 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-card backdrop-blur-xl md:flex">
          <nav
            aria-label="Portal sections"
            className="flex-1 space-y-1 px-3 py-6"
          >
            {nav.map(({ id, label, icon: Icon, count }) => (
              <Button
                key={id}
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start gap-3 rounded-xl px-3.5 py-2.5 text-sm",
                  section === id
                    ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary"
                    : "text-muted-foreground hover:bg-secondary",
                )}
                aria-current={section === id ? "page" : undefined}
                onClick={() => setSection(id)}
              >
                <Icon className="size-4 shrink-0" />
                {label}
                {count > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-auto rounded-full px-1.5 py-0 text-xs"
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            ))}
          </nav>
          <div className="border-t border-border px-4 py-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <Layers className="size-3.5" />
              Portal Status
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-xs text-primary">
              <span className="size-2 rounded-full bg-primary" />
              Signed in
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-x-hidden px-5 py-7 pb-24 md:pb-7">
          <PortalStatus />
          {signOutError && (
            <div role="alert" className="mb-4 text-sm text-destructive">
              {signOutError}
            </div>
          )}
          {section === "profile" && <ProfileSection />}
          {section === "queries" && <QueriesSection />}
          {section === "projects" && <ProjectsSection />}
          <div hidden={section !== "chat"}>
            <ChatSection />
          </div>
        </main>
      </div>
      <nav
        aria-label="Mobile portal sections"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/85 backdrop-blur-xl md:hidden"
      >
        {nav.map(({ id, label, icon: Icon, count }) => (
          <Button
            key={id}
            variant="ghost"
            className={cn(
              "relative h-auto flex-1 flex-col gap-1 rounded-none py-3 text-xs hover:bg-secondary",
              section === id
                ? "text-primary hover:text-primary"
                : "text-muted-foreground",
            )}
            aria-current={section === id ? "page" : undefined}
            onClick={() => setSection(id)}
          >
            <Icon className="size-5" />
            {label}
            {count > 0 && (
              <Badge
                variant="destructive"
                className="absolute right-1/4 top-2 rounded-full px-1 py-0 text-xs"
              >
                {count}
              </Badge>
            )}
          </Button>
        ))}
      </nav>
    </div>
  )
}
