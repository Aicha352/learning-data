"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Notification } from "@/lib/types";

import { Dropdown } from "../ui/dropdown";

export function NotificationBell() {
  const router = useRouter();
  const { data, mutate } = useApi<{ unread: number; results: Notification[] }>("/api/notifications/", {
    refreshInterval: 60_000,
  });
  const unread = data?.unread ?? 0;

  async function open(notification: Notification, close: () => void) {
    close();
    if (!notification.is_read) {
      await api(`/api/notifications/${notification.id}/read/`, { method: "POST" }).catch(() => undefined);
      void mutate();
    }
    if (notification.link) router.push(notification.link);
  }

  async function readAll() {
    await api("/api/notifications/read-all/", { method: "POST" }).catch(() => undefined);
    void mutate();
  }

  return (
    <Dropdown
      label="Notifications"
      className="w-[min(22rem,calc(100vw-2rem))] p-0"
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-label={unread ? `Notifications (${unread} non lues)` : "Notifications"}
          className="relative flex size-10 items-center justify-center rounded-xl border border-line bg-white text-ink transition-colors hover:bg-slate-50"
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-600 px-1 text-[11px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold">Notifications</p>
            {unread > 0 && (
              <button onClick={readAll} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                <CheckCheck className="size-3.5" /> Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {!data?.results.length ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Aucune notification pour le moment.</p>
            ) : (
              data.results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => open(item, close)}
                  className={cn("flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-slate-50", !item.is_read && "bg-brand-50/50")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.is_read ? "bg-transparent" : "bg-brand-600")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{item.title}</span>
                    {item.body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{item.body}</span>}
                    <span className="mt-1 block text-xs text-slate-400">{timeAgo(item.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
