import React, { useState } from 'react';
import { Button } from './Button';
import { UserData } from '../types';
import { ArrowRight } from 'lucide-react';

interface StepFormProps {
  initialData: UserData;
  onSubmit: (data: Partial<UserData>) => void;
}

export const StepForm: React.FC<StepFormProps> = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = useState({
    userName: initialData.userName,
    worstMoment: initialData.worstMoment,
    bestMoment: initialData.bestMoment
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.userName && formData.worstMoment && formData.bestMoment) {
      onSubmit(formData);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto h-full animate-fade-in px-4">
      <h2 className="text-3xl md:text-5xl comic-title text-center mb-8 bg-white border-4 border-black px-6 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        TU HISTORIA EN KPMG
      </h2>

      <form onSubmit={handleSubmit} className="w-full bg-white p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6">
        
        <div>
          <label className="block text-xl font-bold mb-2 comic-title uppercase">Tu nombre</label>
          <input
            type="text"
            name="userName"
            value={formData.userName}
            onChange={handleChange}
            placeholder="Ej. María García"
            className="w-full text-2xl p-4 border-4 border-black focus:outline-none focus:ring-4 focus:ring-[#005EB8] bg-gray-50 font-bold"
            required
          />
        </div>

        <div>
          <label className="block text-xl font-bold mb-2 comic-title uppercase">Tu mejor momento en KPMG</label>
          <input
            type="text"
            name="bestMoment"
            value={formData.bestMoment}
            onChange={handleChange}
            placeholder="Ej. El día que cerré mi primer proyecto"
            className="w-full text-xl p-4 border-4 border-black focus:outline-none focus:ring-4 focus:ring-[#00A3A1] bg-gray-50"
            required
          />
           <p className="text-sm text-gray-500 mt-1 font-sans">Este será tu glorioso final.</p>
        </div>

        <div>
          <label className="block text-xl font-bold mb-2 comic-title uppercase">Tu peor momento en KPMG</label>
          <input
            type="text"
            name="worstMoment"
            value={formData.worstMoment}
            onChange={handleChange}
            placeholder="Ej. Aquel sprint de 72 horas antes del deadline"
            className="w-full text-xl p-4 border-4 border-black focus:outline-none focus:ring-4 focus:ring-red-400 bg-gray-50"
            required
          />
          <p className="text-sm text-gray-500 mt-1 font-sans">Este será tu momento oscuro.</p>
        </div>

        <div className="pt-4">
          <Button type="submit" fullWidth>
            GENERAR CÓMIC <ArrowRight className="ml-2 w-6 h-6 inline" />
          </Button>
        </div>

      </form>
    </div>
  );
};
