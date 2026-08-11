import type { SVGProps } from "react";

export function SystemModeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M16 4.66669C13.4969 4.66669 10.2079 4.87918 7.81808 5.06422C5.96953 5.20737 4.48591 6.63047 4.30095 8.47531C4.14575 10.0234 4 11.8675 4 13.3334C4 14.7992 4.14575 16.6432 4.30095 18.1914C4.48591 20.0363 5.96953 21.4594 7.81808 21.6024C10.2079 21.7875 13.4969 22 16 22C18.5031 22 21.7921 21.7875 24.1819 21.6024C26.0305 21.4594 27.5141 20.0363 27.6991 18.1914C27.8543 16.6432 28 14.7992 28 13.3334C28 11.8675 27.8543 10.0234 27.6991 8.47531C27.5141 6.63047 26.0305 5.20737 24.1819 5.06422C21.7921 4.87918 18.5031 4.66669 16 4.66669Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.3334 26.6666H20.6667"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 22.6666V26.6666"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
