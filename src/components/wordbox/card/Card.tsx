import React from "react";
// @ts-ignore: CSS module declarations are not available in this project setup
import styles from "./Card.module.scss";
import { CardProps } from './card.types';

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  imageSrc,
  imageAlt,
  href,
  children,
  footer,
  className = "",
}) => {
  const content = (
    <div className={`${styles.cardComponent} ${className}`.trim()}>
      {imageSrc ? (
        <div className={styles.cardImage}>
          <img
            src={imageSrc}
            alt={imageAlt ?? (typeof title === "string" ? title : "card image")}
            className={styles.cardImageElement}
          />
        </div>
      ) : null}

      <div className={styles.cardBody}>
        {title ? <h2 className={styles.cardTitle}>{title}</h2> : null}
        {subtitle ? <p className={styles.cardSubtitle}>{subtitle}</p> : null}
        {children ? <div className={styles.cardContent}>{children}</div> : null}
      </div>

      {footer ? <div className={styles.cardFooter}>{footer}</div> : null}
    </div>
  );

  if (href) {
    return (
      <a href={href} className={styles.cardLink}>
        {content}
      </a>
    );
  }

  return content;
};

export default Card;
