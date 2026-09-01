import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import { LessonHeader } from "@/components/LessonHeader";

const docsComponents = getDocsMDXComponents();
const DocsWrapper = docsComponents.wrapper;

/** レッスンページの本文の前にパンくずと状態バッジを差し込む */
function Wrapper({ children, metadata, ...props }) {
  return (
    <DocsWrapper metadata={metadata} {...props}>
      <LessonHeader metadata={metadata ?? {}} />
      {children}
    </DocsWrapper>
  );
}

export const useMDXComponents = (components) => ({
  ...docsComponents,
  wrapper: Wrapper,
  ...components,
});
