import * as React from "react";

export interface ProfilerContextValue {
  renderedComponents: Array<React.ComponentType | string>;
}

const ProfilerContext = React.createContext<ProfilerContextValue | undefined>(
  undefined
);

export function ProfilerContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ProfilerContextValue;
}) {
  const parentContext = useProfilerContext();

  if (parentContext) {
    throw new Error("Profilers should not be nested in the same tree");
  }

  return (
    <ProfilerContext.Provider value={value}>
      {children}
    </ProfilerContext.Provider>
  );
}

export function useProfilerContext() {
  return React.useContext(ProfilerContext);
}
