const config = {
  plugins: {
    "@tailwindcss/postcss": (await import("@tailwindcss/postcss")).default,
  },
};

export default config;
