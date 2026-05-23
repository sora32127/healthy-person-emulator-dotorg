export const H1: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <h1 className="text-3xl font-bold mt-16 mb-6 text-center">{children}</h1>;
};

export const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <h2 className="text-3xl font-bold mt-16 mb-6 text-center">{children}</h2>;
};

export const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <h3 className="text-2xl font-bold mt-10 mb-6">{children}</h3>;
};

export const H4: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => {
  return (
    <h4 id={id} className="text-xl font-bold mt-8 mb-4">
      {children}
    </h4>
  );
};
