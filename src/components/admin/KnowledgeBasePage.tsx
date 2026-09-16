import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  getKnowledgeArticle,
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_BASE_PATH,
} from "../../data/knowledgeBase";
import "./KnowledgeBasePage.css";

export function KnowledgeBasePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const article = slug ? getKnowledgeArticle(slug) : null;
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return KNOWLEDGE_ARTICLES;
    }
    return KNOWLEDGE_ARTICLES.filter((entry) =>
      `${entry.title} ${entry.summary} ${entry.body.join(" ")}`
        .toLowerCase()
        .includes(value),
    );
  }, [query]);

  if (!slug) {
    const first = KNOWLEDGE_ARTICLES[0];
    return <Navigate to={`${KNOWLEDGE_BASE_PATH}/${first.slug}`} replace />;
  }

  if (!article) {
    return <Navigate to={KNOWLEDGE_BASE_PATH} replace />;
  }

  const articlePath = `${KNOWLEDGE_BASE_PATH}/${article.slug}`;

  async function copyLink() {
    const url = `${window.location.origin}${articlePath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="managementShell knowledgePage">
      <header className="managementTopbar">
        <Link className="sharePreviewBrand" to="/">
          <img src="/favi.png" alt="" width={44} height={44} />
          <span>InkLex</span>
        </Link>
        <Link className="managementBack" to="/">
          Back to cards
        </Link>
      </header>

      <div className="knowledgeLayout">
        <aside className="knowledgeNav">
          <p className="eyebrow">Admin</p>
          <h1>Knowledge base</h1>
          <p className="knowledgeLead">
            Internal notes. Only admins can open this page.
          </p>
          <input
            aria-label="Search articles"
            className="knowledgeSearch"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            type="search"
            value={query}
          />
          <div className="knowledgeList">
            {filtered.map((entry) => (
              <button
                className={`knowledgeNavItem${entry.slug === article.slug ? " isActive" : ""}`}
                key={entry.slug}
                onClick={() => navigate(`${KNOWLEDGE_BASE_PATH}/${entry.slug}`)}
                type="button"
              >
                <strong>{entry.title}</strong>
                <span>{entry.summary}</span>
              </button>
            ))}
            {filtered.length === 0 ? (
              <p className="managementEmpty">No matching articles.</p>
            ) : null}
          </div>
        </aside>

        <article className="knowledgeArticle">
          <div className="knowledgeArticleHead">
            <h2>{article.title}</h2>
            <button className="knowledgeCopy" onClick={() => void copyLink()} type="button">
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          {article.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
      </div>
    </main>
  );
}
