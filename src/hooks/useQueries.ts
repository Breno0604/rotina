import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useInstallationId } from "../app/installation";

export function useObjectives() {
  const installationId = useInstallationId();
  return useQuery(api.objectives.list, { installationId });
}

export function useRecordsRange(from: string, to: string) {
  const installationId = useInstallationId();
  return useQuery(api.records.listByRange, { installationId, from, to });
}

export function useAllRecords() {
  const installationId = useInstallationId();
  return useQuery(api.records.listByRange, { installationId });
}

export function useDayNote(dayKey: string) {
  const installationId = useInstallationId();
  return useQuery(api.dailyNotes.get, { installationId, dayKey });
}

export function useNotesRange(from: string, to: string) {
  const installationId = useInstallationId();
  return useQuery(api.dailyNotes.listRange, { installationId, from, to });
}

export function useMemories() {
  const installationId = useInstallationId();
  return useQuery(api.memories.list, { installationId });
}

export function useAnalyses() {
  const installationId = useInstallationId();
  return useQuery(api.analyses.list, { installationId });
}
