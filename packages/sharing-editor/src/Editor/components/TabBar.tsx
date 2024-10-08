import React from "react";
import styles from "./TabBar.module.scss";

interface TabBarProps {
  children: React.ReactNode;
}
function TabBar(props: TabBarProps) {
  return (
    <div className={styles.tabBar} role="tablist">
      {props.children}
    </div>
  );
}

export default TabBar;
