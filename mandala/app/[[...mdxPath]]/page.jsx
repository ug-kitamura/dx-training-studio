import { generateStaticParamsFor, importPage } from "nextra/pages";
// hook ではない（Nextra の命名）。rules-of-hooks に掛からないよう別名で import する（公式作法）
import { useMDXComponents as getMDXComponents } from "../../mdx-components.js";
import { siteChrome } from "../../lib/site-data";

export const generateStaticParams = generateStaticParamsFor("mdxPath");

export async function generateMetadata(props) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  // タブタイトルはページ内容に関わらずサイト名固定にする
  // （ページ別の frontmatter title は無視する）。
  return { ...metadata, title: siteChrome().name };
}

const Wrapper = getMDXComponents().wrapper;

export default async function Page(props) {
  const params = await props.params;
  const { default: MDXContent, toc, metadata } = await importPage(params.mdxPath);
  return (
    <Wrapper toc={toc} metadata={metadata}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
