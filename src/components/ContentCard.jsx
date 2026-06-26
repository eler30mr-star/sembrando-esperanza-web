import { Link } from 'react-router-dom';

export default function ContentCard({ image, title, description, meta, to, action = 'Leer más', variant = 'default' }) {
  const Wrapper = to ? Link : 'article';
  const props = to ? { to } : {};

  return (
    <Wrapper className={`content-card ${variant}`} {...props}>
      {image && <img src={image} alt={title} loading="lazy" />}
      <div className="content-card-body">
        {meta && <span className="card-meta">{meta}</span>}
        <h3>{title}</h3>
        <p>{description}</p>
        {to && <span className="card-action">{action}</span>}
      </div>
    </Wrapper>
  );
}
