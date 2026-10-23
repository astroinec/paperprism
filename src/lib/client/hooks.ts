"use client";

import useSWR from "swr";
import { fetcher } from "./api";
import type { Paper, Project, ProjectDetail, Provider, ServerSettings } from "@/lib/shared/types";

export const useProviders = () => useSWR<Provider[]>("/api/providers", fetcher);
export const useServerSettings = () => useSWR<ServerSettings>("/api/settings", fetcher);
export const usePapers = () => useSWR<Paper[]>("/api/papers", fetcher);
export const useProjects = () => useSWR<Project[]>("/api/projects", fetcher);
export const useProject = (id: string) => useSWR<ProjectDetail>(`/api/projects/${id}`, fetcher);
