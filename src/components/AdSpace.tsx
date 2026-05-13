// src/components/AdSpace.tsx
'use client';

import React from 'react';
import Image from 'next/image';

interface AdSpaceProps {
  type: 'banner' | 'sidebar' | 'in-content';
  className?: string;
  imageSrc?: string;
  linkUrl?: string;
  altText?: string;
}

export default function AdSpace({ 
  type, 
  className = '', 
  imageSrc, 
  linkUrl,
  altText = 'Advertisement'
}: AdSpaceProps) {
  const defaultImages = {
    banner: '/ads/banner1.png',
    sidebar: '/ads/teravolt_ad_1035x315_updated.png',
    'in-content': '/ads/banner2.png',
  };

  // Responsive sizes - different for mobile and desktop
  const sizes = {
    banner: 'w-full h-[50px] sm:h-[60px] md:h-[80px] lg:h-[90px]',
    sidebar: 'w-full h-[120px] sm:h-[150px] md:h-[180px] lg:h-[200px]',
    'in-content': 'w-full h-[120px] sm:h-[150px] md:h-[180px] lg:h-[200px]',
  };

  const adImage = imageSrc || defaultImages[type];

  const AdContent = () => (
    <div className={`${sizes[type]} ${className} relative rounded-lg overflow-hidden`}
      style={{
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: '1px solid var(--border-primary)',
        backgroundColor: 'var(--surface-secondary)',
      }}
    >
      {adImage ? (
        <Image
          src={adImage}
          alt={altText}
          fill
          className="object-contain"
          sizes={
            type === 'banner' 
              ? '(max-width: 640px) 100vw, (max-width: 768px) 100vw, (max-width: 1024px) 90vw, 728px'
              : '(max-width: 640px) 100vw, (max-width: 768px) 100vw, 300px'
          }
          priority={type === 'banner'}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg mb-1">📢</div>
            <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
              Your Ad Here
            </p>
          </div>
        </div>
      )}
      
      {/* Ad label - smaller on mobile */}
      <div 
        className="absolute top-0.5 right-0.5 px-1 py-0.5 rounded text-[8px] sm:text-[10px] font-medium"
        style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'white',
        }}
      >
        AD
      </div>
    </div>
  );

  if (linkUrl) {
    return (
      <a 
        href={linkUrl} 
        target="_blank" 
        rel="noopener noreferrer sponsored"
        className="block"
      >
        <AdContent />
      </a>
    );
  }

  return <AdContent />;
}