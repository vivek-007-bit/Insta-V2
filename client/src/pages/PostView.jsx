import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";
import postService from "../services/postService";
import PostCard from "../components/posts/PostCard";

export default function PostView() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPost = async () => {
      setLoading(true);
      setErrorInfo(null);
      try {
        const res = await postService.getPostById(postId);
        if (isMounted) setPost(res.post);
      } catch (err) {
        if (isMounted) {
          setErrorInfo({
            message: err.message || "This post is unavailable",
            isPrivate: err.message?.includes("private") || false
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (postId) fetchPost();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  if (loading) {
    return (
      <div style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center", color: "var(--text-secondary)" }}>
        Loading post...
      </div>
    );
  }

  if (errorInfo) {
    return (
      <div style={{ maxWidth: "480px", margin: "60px auto", padding: "24px", textAlign: "center" }}>
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            border: "2px solid var(--text-primary)",
            margin: "0 auto 16px auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Lock size={28} />
        </div>
        <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: "600", marginBottom: "8px" }}>
          Private Content
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--font-size-sm)", marginBottom: "20px" }}>
          {errorInfo.message}
        </p>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--accent-blue)",
            fontSize: "var(--font-size-sm)",
            fontWeight: "600"
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Feed</span>
        </Link>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div style={{ maxWidth: "470px", margin: "24px auto", padding: "0 10px" }}>
      <PostCard post={post} />
    </div>
  );
}
