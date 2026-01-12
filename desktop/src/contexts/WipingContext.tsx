import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  subscribeToProgress,
  subscribeToStatus,
  WipingTechnique,
} from "../services/wipingService";
import { WipingProgressData } from "../components/WipingProgress";
import { WipingStatusData } from "../components/WipingStatus";

export interface ActiveWipingOperation {
  operationId: string;
  deviceIds: string[];
  technique: WipingTechnique;
  startedAt: Date;
  progress: Map<string, WipingProgressData>;
  status: Map<string, WipingStatusData>;
}

interface WipingContextType {
  activeOperation: ActiveWipingOperation | null;
  setActiveOperation: (operation: ActiveWipingOperation | null) => void;
  isWiping: boolean;
}

const WipingContext = createContext<WipingContextType | undefined>(undefined);

export function WipingProvider({ children }: { children: ReactNode }) {
  const [activeOperation, setActiveOperation] = useState<ActiveWipingOperation | null>(null);

  // Subscribe to progress and status events globally
  useEffect(() => {
    let unsubscribeProgress: (() => void) | null = null;
    let unsubscribeStatus: (() => void) | null = null;

    const setupListeners = async () => {
      unsubscribeProgress = await subscribeToProgress((progress) => {
        setActiveOperation((prev) => {
          if (!prev) return null;
          const newProgress = new Map(prev.progress);
          newProgress.set(progress.device_id, progress);
          return { ...prev, progress: newProgress };
        });
      });

      unsubscribeStatus = await subscribeToStatus((status) => {
        setActiveOperation((prev) => {
          if (!prev) return null;
          const newStatus = new Map(prev.status);
          newStatus.set(status.device_id, status);
          return { ...prev, status: newStatus };
        });
      });
    };

    setupListeners();

    return () => {
      unsubscribeProgress?.();
      unsubscribeStatus?.();
    };
  }, []);

  const isWiping = activeOperation !== null;

  return (
    <WipingContext.Provider value={{ activeOperation, setActiveOperation, isWiping }}>
      {children}
    </WipingContext.Provider>
  );
}

export function useWiping() {
  const context = useContext(WipingContext);
  if (context === undefined) {
    throw new Error("useWiping must be used within a WipingProvider");
  }
  return context;
}
