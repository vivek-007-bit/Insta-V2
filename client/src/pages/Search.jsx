import React from "react";
import SearchPanel from "../components/navigation/SearchPanel";

export default function Search() {
  return (
    <div style={{ width: "100%", maxWidth: "600px", padding: "20px 16px" }}>
      <SearchPanel isInline={true} />
    </div>
  );
}
