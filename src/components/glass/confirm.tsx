"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Modal } from "./overlay";
import { Button } from "./index";
import { usePrefs } from "@/lib/client/prefs";

type ConfirmFn = (text: string, opts?: { danger?: boolean; okText?: string }) => Promise<boolean>;
const Ctx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { d } = usePrefs();
  const [state, setState] = useState<{ text: string; danger?: boolean; okText?: string } | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const confirm = useCallback<ConfirmFn>((text, opts) => {
    setState({ text, ...opts });
    return new Promise<boolean>((res) => (resolver.current = res));
  }, []);
  const finish = (v: boolean) => {
    resolver.current(v);
    setState(null);
  };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => finish(false)}
        width="max-w-sm"
        footer={
          <>
            <Button onClick={() => finish(false)}>{d.common.cancel}</Button>
            <Button variant={state?.danger ? "danger" : "primary"} onClick={() => finish(true)} autoFocus>
              {state?.okText ?? (state?.danger ? d.common.delete : d.common.confirm)}
            </Button>
          </>
        }
      >
        <p className="pt-4 text-center text-[15px] leading-relaxed">{state?.text}</p>
      </Modal>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(Ctx);
  if (!c) throw new Error("ConfirmProvider missing");
  return c;
}
