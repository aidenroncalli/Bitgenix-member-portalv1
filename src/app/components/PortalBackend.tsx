import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { Session } from "@supabase/supabase-js"
import { Globe, Loader2, LogOut, RefreshCw, Shield } from "lucide-react"
import { supabase } from "../lib/supabase"
import {
  createProject,
  errorMessage,
  loadPortal,
  updateMember,
  updateProject,
  updateQuery,
  type Member,
  type NewProject,
  type Project,
  type Query,
} from "../lib/portal-data"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card"

interface PortalState {
  member: Member
  members: Member[]
  projects: Project[]
  queries: Query[]
}
interface PortalContextValue extends PortalState {
  userId: string
  error: string
  saving: boolean
  refreshing: boolean
  reload: () => Promise<void>
  saveProfile: (
    changes: Pick<Member, "name" | "phone" | "location" | "bio" | "specialisations">,
  ) => Promise<boolean>
  saveProject: (id: string, changes: Partial<Project>) => Promise<boolean>
  addProject: (project: NewProject, imageFile?: File) => Promise<boolean>
  setQueryStatus: (id: string, status: Query["status"]) => Promise<boolean>
}
const PortalContext = createContext<PortalContextValue | null>(null)
export function usePortal() {
  const value = useContext(PortalContext)
  if (!value) throw new Error("Portal data is not available.")
  return value
}

function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError("")
    try {
      const result = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (result.error) throw result.error
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <Card className="w-full max-w-sm rounded-2xl border-border bg-card shadow-none backdrop-blur-xl">
        <CardHeader className="space-y-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <Globe className="size-5 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">
            Welcome to Bitgenix Member Portal
          </CardTitle>
          <CardDescription>
            Sign in with your member account to access the portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="portal-email">Email</Label>
              <Input
                id="portal-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal-password">Password</Label>
              <Input
                id="portal-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </div>
            {error && (
              <div role="alert" className="text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}Sign in
            </Button>
            <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Shield className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Member access only. Ask your administrator for an account if you
                haven’t been invited.
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function PortalDataProvider({
  userId,
  children,
}: {
  userId: string
  children: ReactNode
}) {
  const [data, setData] = useState<PortalState | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const lock = useRef(false)
  const generation = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current++
    }
  }, [])
  const reload = useCallback(async () => {
    if (lock.current) return
    const current = ++generation.current
    setRefreshing(true)
    setError("")
    try {
      const stored = await loadPortal(userId)
      if (mounted.current && current === generation.current) setData(stored)
    } catch (cause) {
      if (mounted.current && current === generation.current)
        setError(errorMessage(cause))
    } finally {
      if (mounted.current && current === generation.current)
        setRefreshing(false)
    }
  }, [userId])
  useEffect(() => {
    void reload()
  }, [reload])

  async function mutate(operation: () => Promise<void>) {
    if (lock.current || refreshing) return false
    lock.current = true
    setSaving(true)
    setError("")
    try {
      await operation()
      return true
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause))
      return false
    } finally {
      lock.current = false
      if (mounted.current) setSaving(false)
    }
  }
  if (!data)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        {refreshing ? (
          <>
            <Loader2 className="size-6 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">
              Loading your member portal…
            </div>
          </>
        ) : (
          <>
            <div
              role="alert"
              className="max-w-lg text-sm leading-relaxed text-destructive"
            >
              {error}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void reload()}>
                <RefreshCw className="size-4" />
                Retry
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  const { error: failure } = await supabase.auth.signOut()
                  if (failure) setError(errorMessage(failure))
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </>
        )}
      </div>
    )
  return (
    <PortalContext.Provider
      value={{
        ...data,
        userId,
        error,
        saving,
        refreshing,
        reload,
        saveProfile: (changes) =>
          mutate(async () => {
            const member = await updateMember(data.member.id, userId, changes)
            if (mounted.current)
              setData(
                (current) =>
                  current && {
                    ...current,
                    member,
                    members: current.members.map((item) =>
                      item.id === member.id ? member : item,
                    ),
                  },
              )
          }),
        saveProject: (id, changes) =>
          mutate(async () => {
            const project = await updateProject(id, changes)
            if (mounted.current)
              setData(
                (current) =>
                  current && {
                    ...current,
                    projects: current.projects.map((item) =>
                      item.id === id ? project : item,
                    ),
                  },
              )
          }),
        addProject: (project, imageFile) =>
          mutate(async () => {
            const created = await createProject(userId, project, imageFile)
            if (mounted.current)
              setData(
                (current) =>
                  current && {
                    ...current,
                    projects: [created, ...current.projects],
                  },
              )
          }),
        setQueryStatus: (id, status) =>
          mutate(async () => {
            const query = await updateQuery(id, status)
            if (mounted.current)
              setData(
                (current) =>
                  current && {
                    ...current,
                    queries: current.queries.map((item) =>
                      item.id === id ? query : item,
                    ),
                  },
              )
          }),
      }}
    >
      {children}
    </PortalContext.Provider>
  )
}

export function PortalBackend({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    let alive = true
    let authEventReceived = false
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        authEventReceived = true
        if (alive) {
          setSession(next)
          setLoading(false)
        }
      },
    )
    supabase.auth
      .getSession()
      .then(({ data, error: failure }) => {
        if (!alive || authEventReceived) return
        if (failure) setError(errorMessage(failure))
        setSession(data.session)
        setLoading(false)
      })
      .catch((cause) => {
        if (alive) {
          setError(errorMessage(cause))
          setLoading(false)
        }
      })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])
  return (
    <div
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      {loading ? (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2
            className="size-6 animate-spin text-primary"
            aria-label="Checking your session"
          />
        </div>
      ) : session ? (
        <PortalDataProvider key={session.user.id} userId={session.user.id}>
          {children}
        </PortalDataProvider>
      ) : (
        <>
          <SignIn />
          {error && (
            <div
              role="alert"
              className="fixed bottom-5 inset-x-5 text-center text-sm text-destructive"
            >
              {error}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function PortalStatus() {
  const { error, saving, refreshing, reload } = usePortal()
  return (
    <div className="mb-5 flex items-center gap-3 text-xs text-muted-foreground">
      {error ? (
        <div role="alert" className="min-w-0 flex-1 text-destructive">
          {error}
        </div>
      ) : (
        <div role="status" className="flex items-center gap-2">
          {(saving || refreshing) && (
            <Loader2 className="size-3.5 animate-spin" />
          )}
          {saving
            ? "Saving to Supabase…"
            : refreshing
              ? "Refreshing…"
              : "Connected to Supabase"}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto text-muted-foreground hover:bg-secondary hover:text-foreground"
        disabled={saving || refreshing}
        onClick={() => void reload()}
      >
        <RefreshCw className="size-3.5" />
        Refresh
      </Button>
    </div>
  )
}
