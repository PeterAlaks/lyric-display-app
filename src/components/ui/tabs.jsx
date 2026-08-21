import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { SlidingTabIndicator } from "@/components/ui/sliding-tab-indicator";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, indicatorClassName, children, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "tab-switcher-squircle relative isolate inline-flex h-9 items-center justify-center rounded-2xl bg-muted p-2 text-muted-foreground",
      className
    )}
    {...props}
  >
    <SlidingTabIndicator className={cn("bg-background shadow", indicatorClassName)} />
    {children}
  </TabsPrimitive.List>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "tab-switcher-item-squircle relative z-10 inline-flex min-w-[120px] items-center justify-center whitespace-nowrap rounded-xl px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:text-foreground",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
