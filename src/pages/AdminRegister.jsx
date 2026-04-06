import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminRegister() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = (e) => {
    e.preventDefault();

    alert("Account created successfully");

    navigate("/admin/login");
  };

  return (

    <div style={{padding:"50px"}}>

      <h2>Create Admin Account</h2>

      <form onSubmit={handleRegister}>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />

        <br/><br/>

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />

        <br/><br/>

        <button type="submit">
          Register Profile
        </button>

      </form>

    </div>

  );

}